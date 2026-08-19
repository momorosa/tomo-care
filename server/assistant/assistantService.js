import { buildQueryPlan } from "./queryPlanner.js"
import { composeGroundedAnswer } from "./answerComposer.js"
import { coordinatePersistedLibrelaAppointmentRequest } from "../orchestration/persistedLibrelaAppointmentWorkflow.js"
import { coordinateCareOperationsHandoff } from "../orchestration/careOperationsHandoff.js"
import { isReadOnlyEvaluationBlocked } from "./evalAssertions.js"
import { getCareDate } from "../lib/careDates.js"
import {
    getNextConversationContext,
    sanitizeConversationContext,
} from "./conversationContext.js"
import { createOpenAiSemanticProvider } from "./openAiSemanticProvider.js"
import { resolveAssistantPlan } from "./semanticUnderstanding.js"
import { applyPersonalityFraming } from "./personalityLayer.js"

const ASSISTANT_CARE_ACTOR = "Rosa"

export class AssistantServiceError extends Error {
    constructor(message, { status = 400, reason = null } = {}) {
        super(message)
        this.name = "AssistantServiceError"
        this.status = status
        this.reason = reason
    }
}

export async function answerAssistantQuestion({
    petId,
    question,
    evaluationMode,
    conversationContext,
    dependencies = {},
}) {
    if (!petId) {
        throw new AssistantServiceError("petId is required.")
    }

    if (!question || typeof question !== "string") {
        throw new AssistantServiceError("question is required.")
    }

    const {
        buildPlan = buildQueryPlan,
        composeAnswer = composeGroundedAnswer,
        coordinateCareOperations = coordinateCareOperationsHandoff,
        coordinateAppointmentRequest =
            coordinatePersistedLibrelaAppointmentRequest,
        currentCareDate = getCareDate(),
    } = dependencies

    const previousContext =
        sanitizeConversationContext(conversationContext)
    const semanticProvider =
        dependencies.semanticProvider === undefined
            ? createOpenAiSemanticProvider()
            : dependencies.semanticProvider
    const {
        queryPlan,
        semanticInterpretation,
    } = await resolveAssistantPlan({
        question,
        currentCareDate,
        conversationContext: previousContext,
        buildPlan,
        semanticProvider,
    })

    if (
        isReadOnlyEvaluationBlocked({
            evaluationMode,
            queryPlan,
        })
    ) {
        throw new AssistantServiceError(
            "Read-only assistant evals cannot prepare a care action.",
            {
                status: 409,
                reason: "read_only_eval_action_blocked",
            }
        )
    }

    const isAttentionSummary = queryPlan.intent === "attention_summary"
    const isProfileSummary = queryPlan.intent === "profile_summary"
    const needsTrustedContext =
        queryPlan.intent !== "social_response" &&
        !isAttentionSummary &&
        !isProfileSummary
    const buildContext = needsTrustedContext
        ? dependencies.buildContext ||
          (await import("./contextBuilder.js")).buildTrustedContext
        : null
    const context = buildContext ? await buildContext(petId) : {}
    const attentionRepository = isAttentionSummary
        ? dependencies.attentionRepository ||
          (await import("../attention/attentionRepository.js"))
              .attentionRepository
        : null
    const buildAttention = isAttentionSummary
        ? dependencies.buildAttention ||
          (await import("../attention/attentionService.js"))
              .buildAttentionSummary
        : null
    const attentionSummary = buildAttention
        ? await buildAttention({
              repository: attentionRepository,
              petId,
              currentCareDate,
              dateRange: queryPlan.date_range,
          })
        : null
    const profileRepository = isProfileSummary
        ? dependencies.profileRepository ||
          (await import("../profile/profileRepository.js")).profileRepository
        : null
    const buildProfile = isProfileSummary
        ? dependencies.buildProfile ||
          (await import("../profile/governedProfile.js")).buildGovernedProfile
        : null
    const profileSummary = buildProfile
        ? await buildProfile({
              repository: profileRepository,
              petId,
              currentCareDate,
          })
        : null
    const isCareOperationsIntent = [
        "home_medication_status",
        "home_medication_due",
        "home_medication_given_action",
    ].includes(queryPlan.intent)
    const actionRepository =
        isCareOperationsIntent
            ? dependencies.actionRepository ||
              (await import("../repositories/careActionRepository.js"))
                  .careActionRepository
            : null
    const orchestrationRepository =
        queryPlan.intent === "librela_appointment_message" ||
        isCareOperationsIntent
            ? dependencies.orchestrationRepository ||
              (await import("../repositories/orchestrationRunRepository.js"))
                  .orchestrationRunRepository
            : null
    const careOperations = isCareOperationsIntent
        ? await coordinateCareOperations({
              petId,
              queryPlan,
              context,
              currentCareDate,
              requestedBy: ASSISTANT_CARE_ACTOR,
              actionRepository,
              orchestrationRepository,
          })
        : null
    const actionPreparation =
        careOperations?.actionPreparation || null
    const messageDraftPreparation =
        queryPlan.intent === "librela_appointment_message"
            ? await coordinateAppointmentRequest({
                  repository: orchestrationRepository,
                  petId,
                  context,
                  currentCareDate,
                  senderName: ASSISTANT_CARE_ACTOR,
                  petName: "Momo",
              })
            : null

    const response = composeAnswer({
        question,
        queryPlan,
        context,
        actionPreparation,
        messageDraftPreparation,
        attentionSummary,
        profileSummary,
    })
    const personalizeAnswer =
        dependencies.personalizeAnswer || applyPersonalityFraming
    const personalizedResponse = personalizeAnswer({
        response,
        question,
        queryPlan,
        semanticInterpretation,
    })

    return {
        ...personalizedResponse,
        orchestration_trace:
            careOperations?.orchestrationTrace ||
            personalizedResponse.orchestration_trace ||
            null,
        semantic_interpretation: semanticInterpretation,
        conversation_context: getNextConversationContext({
            queryPlan,
            previousContext,
        }),
    }
}
