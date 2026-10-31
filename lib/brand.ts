// WCAG relative luminance. Keep each client's color while making text readable.
export function contrastRatio(a: string, b: string) {
  const luminance = (hex: string) => {
    const rgb = hex
      .slice(1)
      .match(/../g)!
      .map((v) => parseInt(v, 16) / 255)
      .map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
    return rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722;
  };
  const x = luminance(a),
    y = luminance(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}
export function brandStyle(input?: string) {
  const brand = /^#[a-f\d]{6}$/i.test(input || "") ? input! : "#6756d8";
  let ink = brand;
  while (contrastRatio(ink, "#f1effc") < 4.8) {
    ink =
      "#" +
      ink
        .slice(1)
        .match(/../g)!
        .map((value) =>
          Math.floor(parseInt(value, 16) * 0.95)
            .toString(16)
            .padStart(2, "0"),
        )
        .join("");
  }
  return {
    "--brand": brand,
    "--brand-ink": ink,
    "--brand-contrast":
      contrastRatio(brand, "#ffffff") >= 4.5 ? "#ffffff" : "#000000",
  };
}
