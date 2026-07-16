import { FLAG_CODES } from "./flagCodes";
import "./Flag.css";

const FLAG_CODE_SET = new Set(FLAG_CODES);
const FLAG_BASE_PATH = `${process.env.PUBLIC_URL || ""}/flags/4x3`;

export default function Flag({ countryCode, className = "" }) {
  const code = String(countryCode || "").toLowerCase();
  if (!FLAG_CODE_SET.has(code)) return null;

  return (
    <img
      alt=""
      aria-hidden="true"
      className={["flag-image", className].filter(Boolean).join(" ")}
      width="21"
      height="16"
      decoding="async"
      src={`${FLAG_BASE_PATH}/${code}.svg`}
    />
  );
}
