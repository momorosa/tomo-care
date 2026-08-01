import { buildQueryPlan } from "./queryPlanner.js"
import { composeGroundedAnswer } from "./answerComposer.js"
import { prepareAssistantHomeMedicationAction } from "./homeMedicationAction.js"
import { coordinatePersistedLibrelaAppointmentRequest } from "../orchestration/persistedLibrelaAppointmentWorkflow.js"
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
        prepareMedicationAction = prepareAssistantHomeMedicationAction,
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

    const needsTrustedContext = queryPlan.intent !== "social_response"
    const buildContext = needsTrustedContext
        ? dependencies.buildContext ||
          (await import("./contextBuilder.js")).buildTrustedContext
        : null
    const context = buildContext ? await buildContext(petId) : {}
    const actionRepository =
        queryPlan.intent === "home_medication_given_action"
            ? dependencies.actionRepository ||
              (await import("../repositories/careActionRepository.js"))
                  .careActionRepository
            : null
    const orchestrationRepository =
        queryPlan.intent === "librela_appointment_message"
            ? dependencies.orchestrationRepository ||
              (await import("../repositories/orchestrationRunRepository.js"))
                  .orchestrationRunRepository
            : null
    const actionPreparation =
        queryPlan.intent === "home_medication_given_action"
            ? await prepareMedicationAction({
                  repository: actionRepository,
                  petId,
                  queryPlan,
                  context,
                  requestedBy: ASSISTANT_CARE_ACTOR,
                  currentCareDate,
              })
            : null
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
        semantic_interpretation: semanticInterpretation,
        conversation_context: getNextConversationContext({
            queryPlan,
            previousContext,
        }),
    }
}
