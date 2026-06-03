import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

/** Constant scroll speed (px/s) so more images = longer loop, same perceived speed */
const MARQUEE_PX_PER_SECOND = 52;

function prefersReducedMotion() {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function GalleryGrid({ images, resolveAssetUrl }) {
  return (
    <div className="event-gallery-grid">
      {images.map((img) => (
        <figure className="event-gallery-grid-item" key={img.id}>
          <img src={resolveAssetUrl(img.image_url)} alt="" loading="lazy" />
        </figure>
      ))}
    </div>
  );
}

function GallerySlideshow({ images, resolveAssetUrl }) {
  const [index, setIndex] = useState(0);
  const reduced = prefersReducedMotion();

  useEffect(() => {
    setIndex(0);
  }, [images]);

  useEffect(() => {
    if (reduced || images.length <= 1) return undefined;
    const timer = window.setInterval(() => {
      setIndex((i) => (i + 1) % images.length);
    }, 5000);
    return () => window.clearInterval(timer);
  }, [images, reduced]);

  if (reduced) {
    return <GalleryGrid images={images} resolveAssetUrl={resolveAssetUrl} />;
  }

  const go = (delta) => {
    setIndex((i) => (i + delta + images.length) % images.length);
  };

  return (
    <div className="event-gallery-slideshow">
      <div className="event-gallery-slideshow-stage">
        {images.map((img, i) => (
          <figure
            key={img.id}
            className={`event-gallery-slide${i === index ? " is-active" : ""}`}
            aria-hidden={i !== index}
          >
            <img src={resolveAssetUrl(img.image_url)} alt="" />
          </figure>
        ))}
        {images.length > 1 ? (
          <>
            <button type="button" className="event-gallery-nav event-gallery-nav--prev" onClick={() => go(-1)} aria-label="Föregående bild">
              ‹
            </button>
            <button type="button" className="event-gallery-nav event-gallery-nav--next" onClick={() => go(1)} aria-label="Nästa bild">
              ›
            </button>
          </>
        ) : null}
      </div>
      {images.length > 1 ? (
        <div className="event-gallery-dots" role="tablist" aria-label="Bilder i galleriet">
          {images.map((img, i) => (
            <button
              key={img.id}
              type="button"
              role="tab"
              aria-selected={i === index}
              aria-label={`Bild ${i + 1}`}
              className={`event-gallery-dot${i === index ? " is-active" : ""}`}
              onClick={() => setIndex(i)}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function GalleryMarquee({ images, resolveAssetUrl }) {
  const trackRef = useRef(null);
  const reduced = prefersReducedMotion();

  const syncMarqueeDuration = useCallback(() => {
    const track = trackRef.current;
    if (!track) return;
    const loopWidth = track.scrollWidth / 2;
    if (!loopWidth) return;
    const seconds = Math.max(14, Math.min(200, loopWidth / MARQUEE_PX_PER_SECOND));
    track.style.setProperty("--marquee-duration", `${seconds}s`);
  }, []);

  useLayoutEffect(() => {
    if (reduced) return undefined;
    syncMarqueeDuration();
    const track = trackRef.current;
    if (!track) return undefined;

    const ro = new ResizeObserver(() => syncMarqueeDuration());
    ro.observe(track);
    const container = track.parentElement;
    if (container) ro.observe(container);

    window.addEventListener("resize", syncMarqueeDuration);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", syncMarqueeDuration);
    };
  }, [images, reduced, syncMarqueeDuration]);

  if (reduced) {
    return <GalleryGrid images={images} resolveAssetUrl={resolveAssetUrl} />;
  }

  const loopImages = [...images, ...images];
  return (
    <div className="event-gallery-marquee" aria-label="Bildgalleri med rörlig visning">
      <div ref={trackRef} className="event-gallery-marquee-track">
        {loopImages.map((img, i) => (
          <figure className="event-gallery-marquee-item" key={`${img.id}-${i}`}>
            <img
              src={resolveAssetUrl(img.image_url)}
              alt=""
              loading="lazy"
              onLoad={syncMarqueeDuration}
            />
          </figure>
        ))}
      </div>
    </div>
  );
}

export function EventGallery({ images, mode, resolveAssetUrl }) {
  const list = Array.isArray(images) ? images.filter((img) => img?.image_url) : [];
  if (list.length === 0) return null;

  const normalizedMode = mode === "slideshow" || mode === "marquee" ? mode : "grid";

  return (
    <div className={`event-gallery event-gallery--${normalizedMode}`}>
      {normalizedMode === "slideshow" ? (
        <GallerySlideshow images={list} resolveAssetUrl={resolveAssetUrl} />
      ) : normalizedMode === "marquee" ? (
        <GalleryMarquee images={list} resolveAssetUrl={resolveAssetUrl} />
      ) : (
        <GalleryGrid images={list} resolveAssetUrl={resolveAssetUrl} />
      )}
    </div>
  );
}
