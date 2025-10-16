import { toast } from "react-hot-toast";
import { CheckCircle, XCircle, Info } from "lucide-react";

const TYPE_STYLES = {
  success: {
    Icon: CheckCircle,
    border: "border-emerald-500/40",
    icon: "text-emerald-300",
  },
  error: {
    Icon: XCircle,
    border: "border-rose-500/40",
    icon: "text-rose-300",
  },
  info: {
    Icon: Info,
    border: "border-sky-500/40",
    icon: "text-sky-300",
  },
};

export function showToast({
  message,
  description,
  type = "success",
  duration = 4000,
} = {}) {
  if (!message) return;

  const style = TYPE_STYLES[type] || TYPE_STYLES.info;
  const { Icon, border, icon } = style;

  return toast.custom(
    (t) => (
      <div
        className={[
          "pointer-events-auto w-80 rounded-xl bg-[#0f0f17]/95 backdrop-blur border shadow-lg",
          "px-4 py-3 text-sm text-white flex items-start gap-3 transition-all duration-200",
          border,
          t.visible ? "translate-x-0 opacity-100" : "translate-x-6 opacity-0",
        ].join(" ")}
      >
        <div
          className={[
            "mt-0.5 rounded-full bg-white/5 p-1.5 flex-shrink-0",
            icon,
          ].join(" ")}
        >
          <Icon className="w-4 h-4" />
        </div>
        <div className="flex-1">
          <p className="font-semibold text-sm leading-5">{message}</p>
          {description && (
            <p className="mt-1 text-xs text-white/70 leading-4">
              {description}
            </p>
          )}
        </div>
      </div>
    ),
    {
      position: "top-right",
      duration,
    }
  );
}

export default showToast;
