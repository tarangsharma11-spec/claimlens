"use client";
import { useState, useCallback, useRef } from "react";

/**
 * useStreamingChat — Hook for streaming AI responses via SSE.
 *
 * Replaces the blocking fetch + "Reviewing..." spinner with
 * real-time token-by-token display.
 *
 * Usage:
 *   const { send, isStreaming, streamText } = useStreamingChat({
 *     onComplete: (fullText) => { ... save to claim ... },
 *     onError: (err) => { ... },
 *   });
 *
 *   // In your chat component:
 *   await send(messages, { documentTexts, claimContext });
 *   // While streaming, streamText updates in real-time
 */
export function useStreamingChat({ onComplete, onError } = {}) {
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamText, setStreamText] = useState("");
  const abortRef = useRef(null);

  const abort = useCallback(() => {
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
    setIsStreaming(false);
  }, []);

  const send = useCallback(
    async (messages, { documentTexts, claimContext } = {}) => {
      // Abort any existing stream
      if (abortRef.current) abortRef.current.abort();

      const controller = new AbortController();
      abortRef.current = controller;

      setIsStreaming(true);
      setStreamText("");

      let fullText = "";

      try {
        const response = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages,
            documentTexts: documentTexts || {},
            claimContext: claimContext || null,
            stream: true,
          }),
          signal: controller.signal,
        });

        if (!response.ok) {
          const err = await response.json().catch(() => ({}));
          throw new Error(err.error || `HTTP ${response.status}`);
        }

        const contentType = response.headers.get("content-type") || "";

        if (contentType.includes("text/event-stream")) {
          // SSE streaming mode
          const reader = response.body.getReader();
          const decoder = new TextDecoder();
          let buffer = "";

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split("\n");
            buffer = lines.pop() || "";

            for (const line of lines) {
              if (!line.startsWith("data: ")) continue;
              try {
                const event = JSON.parse(line.slice(6));
                if (event.text) {
                  fullText += event.text;
                  setStreamText(fullText);
                }
                if (event.done) {
                  // Stream complete
                }
                if (event.error) {
                  throw new Error(event.error);
                }
              } catch (e) {
                if (e.message && !e.message.includes("JSON")) throw e;
                // Skip malformed JSON events
              }
            }
          }
        } else {
          // Fallback: non-streaming JSON response (backward compat)
          const data = await response.json();
          fullText = data.reply || "No response.";
          setStreamText(fullText);
        }

        onComplete?.(fullText);
      } catch (err) {
        if (err.name === "AbortError") return; // User cancelled
        onError?.(err);
        fullText = `**Error:** ${err.message}`;
        setStreamText(fullText);
      } finally {
        setIsStreaming(false);
        abortRef.current = null;
      }

      return fullText;
    },
    [onComplete, onError]
  );

  return { send, isStreaming, streamText, abort, setStreamText };
}
