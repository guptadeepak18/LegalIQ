export function LogoWatermark() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-0 flex items-center justify-center overflow-hidden"
    >
      <img
        src="/rtc-logo.png"
        alt=""
        className="w-[640px] max-w-[78vw] opacity-[0.07] dark:opacity-[0.10] select-none"
        style={{ filter: "drop-shadow(0 0 40px rgba(201,168,76,0.25))" }}
      />
    </div>
  );
}
