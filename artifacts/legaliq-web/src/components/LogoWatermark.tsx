export function LogoWatermark() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-0 flex items-center justify-center overflow-hidden"
    >
      <img
        src="/rtc-logo.png"
        alt=""
        className="w-[520px] max-w-[70vw] opacity-[0.04] dark:opacity-[0.06] select-none"
        style={{ filter: "grayscale(1)" }}
      />
    </div>
  );
}
