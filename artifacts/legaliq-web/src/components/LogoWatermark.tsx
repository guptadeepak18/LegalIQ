export function LogoWatermark() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-0 flex items-center justify-center overflow-hidden"
    >
      <img
        src="/rtc-logo-transparent.png"
        alt=""
        className="w-[640px] max-w-[78vw] opacity-[0.07] select-none dark:opacity-[0.12] dark:brightness-0 dark:invert"
      />
    </div>
  );
}
