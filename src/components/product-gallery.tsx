"use client";

import Image from "next/image";
import { useState } from "react";

type GalleryImage = { id: string; url: string; alt: string };

export function ProductGallery({ images, priority = true }: { images: GalleryImage[]; priority?: boolean }) {
  const [active, setActive] = useState(0);
  if (images.length === 0) {
    return <div className="flex aspect-[4/5] items-center justify-center bg-[#f1efe8] text-xs uppercase tracking-widest text-muted">BLOOMÉ</div>;
  }
  const current = images[Math.min(active, images.length - 1)];

  return (
    <div>
      <div className="relative aspect-[4/5] overflow-hidden bg-[#f1efe8]">
        <Image
          key={current.id}
          src={current.url}
          alt={current.alt}
          fill
          priority={priority}
          sizes="(max-width: 1024px) 100vw, 50vw"
          className="object-cover animate-[fade-in_0.5s_ease]"
        />
      </div>
      {images.length > 1 ? (
        <div className="mt-3 grid grid-cols-4 gap-3">
          {images.map((image, index) => (
            <button
              key={image.id}
              type="button"
              onClick={() => setActive(index)}
              className={`relative aspect-square overflow-hidden border ${
                index === active ? "border-primary" : "border-transparent hover:border-line"
              }`}
              aria-label={`${image.alt} ${index + 1}`}
              aria-pressed={index === active}
            >
              <Image src={image.url} alt="" fill sizes="120px" className="object-cover" />
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
