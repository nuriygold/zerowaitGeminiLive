import { useState, useEffect } from "react";

export type UiState = "GREETING" | "LISTENING" | "VERIFY" | "CHECKED_IN" | "ERROR";

export function useVoiceUi() {
  const [ui, setUi] = useState<UiState>("GREETING");

  useEffect(() => {
    document.body.className = `ui-${ui}`;
  }, [ui]);

  function handleUiState(state: string) {
    const validStates: UiState[] = ["GREETING", "LISTENING", "VERIFY", "CHECKED_IN", "ERROR"];
    if (validStates.includes(state as UiState)) {
      setUi(state as UiState);
    }
  }

  return { ui, handleUiState };
}
