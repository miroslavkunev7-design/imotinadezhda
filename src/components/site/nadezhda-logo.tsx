import logoUrl from "@/assets/logo-scroll-banner.png";
import logoMobileUrl from "@/assets/logo-scroll-banner.png";

export type NadezhdaLogoProps = React.ImgHTMLAttributes<HTMLImageElement> & {
  variant?: "default" | "mobile";
};

/**
 * Brand mark for "Недвижими имоти Надежда".
 * Transparent PNG: burgundy brush splash with gold dust and white houses logo.
 * Rendered as a React component so the mark can be swapped/instrumented in one place.
 */
export function NadezhdaLogo({ alt = "Недвижими имоти Надежда", className, variant = "default", ...rest }: NadezhdaLogoProps) {
  return (
    <img
      {...rest}
      src={variant === "mobile" ? logoMobileUrl : logoUrl}
      alt={alt}
      className={className}
      decoding="async"
      loading="eager"
      draggable={false}
    />
  );
}

export default NadezhdaLogo;