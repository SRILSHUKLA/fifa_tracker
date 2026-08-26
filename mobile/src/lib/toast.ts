import { useToast } from "heroui-native";

type ToastManager = ReturnType<typeof useToast>["toast"];

let manager: ToastManager | null = null;

/** Captured once inside the HeroUI Native provider tree by <ToastBridge />. */
export function setToastManager(next: ToastManager) {
  manager = next;
}

function show(options: Parameters<ToastManager["show"]>[0]) {
  manager?.show(options);
}

export const toast = {
  success: (label: string, description?: string) =>
    show({ label, description, variant: "success" }),
  error: (label: string, description?: string) =>
    show({ label, description, variant: "danger" }),
  message: (label: string, description?: string) =>
    show({ label, description, variant: "default" }),
};
