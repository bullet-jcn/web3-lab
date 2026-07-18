import type { ReactNode } from "react";
import { Button } from "./Button";

export function Modal({ onClose, children }: { onClose: () => void; children: ReactNode }) {
  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black/50">
      <div className="rounded-lg bg-white p-6 shadow-lg dark:bg-neutral-900">
        {children}
        <Button variant="ghost" onClick={onClose} className="mt-4">关闭</Button>
      </div>
    </div>
  )
}
