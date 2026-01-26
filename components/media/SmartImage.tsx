import Image, { type ImageProps } from "next/image";

type Props = Omit<ImageProps, "src" | "alt"> & {
  src?: string | null;
  alt?: string;
  /** When true, falls back to a plain <img> for data/blob URLs. */
  allowImgFallback?: boolean;
};

function isDataOrBlobUrl(src: string) {
  return src.startsWith("data:") || src.startsWith("blob:");
}

/**
 * A thin wrapper around `next/image` that:
 * - accepts nullable src
 * - can fall back to <img> for data/blob URLs
 */
export default function SmartImage({ src, alt = "", allowImgFallback = true, ...rest }: Props) {
  if (!src) return null;

  if (allowImgFallback && isDataOrBlobUrl(src)) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt={alt} {...(rest as any)} />;
  }

  return <Image src={src} alt={alt} {...rest} />;
}
