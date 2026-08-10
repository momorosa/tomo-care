import "dotenv/config"
import { fileURLToPath } from "node:url"
import { Buffer } from "node:buffer"
import { mkdtemp, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import process from "node:process"
import {
    audioFramesFromFile,
    cli,
    defineAgent,
    ServerOptions,
    voice,
} from "@livekit/agents"
import * as runway from "@livekit/agents-plugin-runway"
import {
    AVATAR_CONTROL,
    AVATAR_CONTROL_TOPIC,
    AVATAR_SPEECH_TOPIC,
    AVATAR_STATUS,
    AVATAR_STATUS_TOPIC,
    createAvatarStatus,
    MAX_AVATAR_SPEECH_BYTES,
    parseAvatarMessage,
} from "../../shared/avatarProtocol.js"
import { getLiveAvatarConfig } from "./liveAvatarSession.js"

const SUPPORTED_SPEECH_TYPES = new Set(["audio/mpeg", "audio/mp3"])

async function createTemporarySpeechFile(audioBytes) {
    const directory = await mkdtemp(join(tmpdir(), "tomocare-avatar-"))
    const filePath = join(directory, "tomo-speech.mp3")
    await writeFile(filePath, audioBytes)

    return {
        filePath,
        async cleanup() {
            await rm(directory, { recursive: true, force: true })
        },
    }
}

function concatChunks(chunks) {
    return Buffer.concat(chunks.map((chunk) => Buffer.from(chunk)))
}

export function createAvatarSpeechReceiver({
    session,
    room,
    decodeAudio = audioFramesFromFile,
    createTemporaryFile = createTemporarySpeechFile,
    maxSpeechBytes = MAX_AVATAR_SPEECH_BYTES,
}) {
    let activeSpeech = null

    async function sendStatus(participantIdentity, requestId, status, reason) {
        if (!participantIdentity || !requestId) return

        await room.localParticipant.sendText(
            JSON.stringify(createAvatarStatus({ requestId, status, reason })),
            {
                topic: AVATAR_STATUS_TOPIC,
                destinationIdentities: [participantIdentity],
            }
        )
    }

    async function handleSpeech(reader, participant) {
        const requestId = reader.info?.attributes?.requestId
        const contentType = reader.info?.mimeType?.toLowerCase() || ""

        if (!requestId || !SUPPORTED_SPEECH_TYPES.has(contentType)) {
            await sendStatus(
                participant?.identity,
                requestId,
                AVATAR_STATUS.FAILED,
                "unsupported_audio"
            )
            return
        }

        let temporaryFile = null

        try {
            const chunks = await reader.readAll()
            const audioBytes = concatChunks(chunks)

            if (audioBytes.length === 0 || audioBytes.length > maxSpeechBytes) {
                await sendStatus(
                    participant.identity,
                    requestId,
                    AVATAR_STATUS.FAILED,
                    audioBytes.length === 0 ? "empty_audio" : "audio_too_large"
                )
                return
            }

            temporaryFile = await createTemporaryFile(audioBytes)
            await sendStatus(
                participant.identity,
                requestId,
                AVATAR_STATUS.ACCEPTED
            )

            const handle = session.say("", {
                audio: decodeAudio(temporaryFile.filePath, {
                    sampleRate: 16000,
                    numChannels: 1,
                }),
                allowInterruptions: false,
                addToChatCtx: false,
            })
            activeSpeech = {
                handle,
                participantIdentity: participant.identity,
                requestId,
                interrupted: false,
            }
            await sendStatus(
                participant.identity,
                requestId,
                AVATAR_STATUS.PLAYING
            )

            await handle.waitForPlayout()

            if (!activeSpeech?.interrupted) {
                await sendStatus(
                    participant.identity,
                    requestId,
                    AVATAR_STATUS.COMPLETED
                )
            }
        } catch {
            if (!activeSpeech?.interrupted) {
                await sendStatus(
                    participant?.identity,
                    requestId,
                    AVATAR_STATUS.FAILED,
                    "avatar_playback_failed"
                )
            }
        } finally {
            if (activeSpeech?.requestId === requestId) activeSpeech = null
            await temporaryFile?.cleanup()
        }
    }

    async function handleControl(reader, participant) {
        const message = parseAvatarMessage(await reader.readAll())

        if (
            message?.action !== AVATAR_CONTROL.STOP ||
            !activeSpeech ||
            message.request_id !== activeSpeech.requestId ||
            participant?.identity !== activeSpeech.participantIdentity
        ) {
            return
        }

        activeSpeech.interrupted = true
        activeSpeech.handle.interrupt(true)
        await sendStatus(
            participant.identity,
            activeSpeech.requestId,
            AVATAR_STATUS.INTERRUPTED
        )
    }

    return { handleSpeech, handleControl }
}

export function createRunwayAvatarAgent({ env = process.env } = {}) {
    return defineAgent({
        entry: async (ctx) => {
            const config = getLiveAvatarConfig(env)

            if (!config.enabled) {
                throw new Error("Tomo Runway animation is disabled.")
            }

            await ctx.connect()

            const session = new voice.AgentSession()
            const avatar = new runway.AvatarSession({
                avatarId: config.avatarId,
                maxDuration: config.maxDurationSeconds,
                apiKey: config.runwayApiSecret,
            })

            await avatar.start(session, ctx.room, {
                livekitUrl: config.livekitUrl,
                livekitApiKey: config.livekitApiKey,
                livekitApiSecret: config.livekitApiSecret,
            })
            await avatar.waitForJoin({ timeout: 30000 })

            await session.start({
                agent: new voice.Agent({
                    instructions:
                        "Forward only TomoCare-provided audio. Do not converse, reason, or call tools.",
                }),
                room: ctx.room,
                inputOptions: {
                    audioEnabled: false,
                    textEnabled: false,
                },
                outputOptions: {
                    audioEnabled: false,
                    transcriptionEnabled: false,
                },
            })

            const receiver = createAvatarSpeechReceiver({
                session,
                room: ctx.room,
            })
            ctx.room.registerByteStreamHandler(
                AVATAR_SPEECH_TOPIC,
                receiver.handleSpeech
            )
            ctx.room.registerTextStreamHandler(
                AVATAR_CONTROL_TOPIC,
                receiver.handleControl
            )

            ctx.addShutdownCallback(async () => {
                ctx.room.unregisterByteStreamHandler(AVATAR_SPEECH_TOPIC)
                ctx.room.unregisterTextStreamHandler(AVATAR_CONTROL_TOPIC)
            })
        },
    })
}

export default createRunwayAvatarAgent()

if (process.argv[1] === fileURLToPath(import.meta.url)) {
    cli.runApp(
        new ServerOptions({
            agent: fileURLToPath(import.meta.url),
        })
    )
}
