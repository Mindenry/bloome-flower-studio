"use client";

import Image from "next/image";
import { useRef, useState } from "react";
import { useI18n } from "../i18n-provider";
import { IconTrash, IconUpload } from "../icons";

export type UploadItem = { url: string; altTh: string; altEn: string };

export function ImageUploader({
  value,
  onChange,
  prefix = "products",
}: {
  value: UploadItem[];
  onChange: (items: UploadItem[]) => void;
  prefix?: string;
}) {
  const { t } = useI18n();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);

  const upload = async (files: FileList | File[]) => {
    setBusy(true);
    setError(null);
    const next = [...value];
    for (const file of Array.from(files)) {
      if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
        setError(t("validation.fileType"));
        continue;
      }
      if (file.size > 8 * 1024 * 1024) {
        setError(t("validation.fileSize"));
        continue;
      }
      const body = new FormData();
      body.set("file", file);
      body.set("prefix", prefix);
      try {
        const response = await fetch("/api/uploads", { method: "POST", body });
        if (!response.ok) {
          const payload = (await response.json().catch(() => ({}))) as { error?: string };
          setError(t((payload.error ?? "validation.fileType") as never));
          continue;
        }
        const payload = (await response.json()) as { image: { url: string } };
        next.push({ url: payload.image.url, altTh: "", altEn: "" });
      } catch {
        setError(t("error.network"));
      }
    }
    onChange(next);
    setBusy(false);
  };

  const move = (index: number, direction: -1 | 1) => {
    const next = [...value];
    const target = index + direction;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  };

  return (
    <div>
      <input type="hidden" name="images" value={JSON.stringify(value)} />
      <div
        className={`flex cursor-pointer flex-col items-center justify-center border border-dashed px-4 py-8 text-center transition-colors ${
          dragging ? "border-primary bg-primary-soft" : "border-line bg-[#faf9f5] hover:border-primary/60"
        }`}
        onClick={() => inputRef.current?.click()}
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          if (event.dataTransfer.files.length) void upload(event.dataTransfer.files);
        }}
        role="button"
        tabIndex={0}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") inputRef.current?.click();
        }}
      >
        <IconUpload size={22} className="text-primary" />
        <p className="mt-2 text-xs text-muted">{busy ? t("common.loading") : t("admin.uploadHint")}</p>
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          className="sr-only"
          onChange={(event) => {
            if (event.target.files?.length) void upload(event.target.files);
            event.target.value = "";
          }}
        />
      </div>
      {error ? <p className="mt-2 text-xs text-danger">{error}</p> : null}

      {value.length > 0 ? (
        <ul className="mt-4 grid gap-3 sm:grid-cols-2">
          {value.map((image, index) => (
            <li key={`${image.url}-${index}`} className="border border-line bg-white p-3">
              <div className="flex gap-3">
                <div className="relative h-20 w-16 shrink-0 overflow-hidden bg-[#f1eee7]">
                  <Image src={image.url} alt="" fill sizes="64px" className="object-cover" />
                  {index === 0 ? (
                    <span className="absolute left-0 top-0 bg-primary px-1 text-[8px] uppercase tracking-wider text-white">
                      {t("admin.setMainImage")}
                    </span>
                  ) : null}
                </div>
                <div className="min-w-0 flex-1 space-y-1.5">
                  <input
                    value={image.altTh}
                    onChange={(event) => {
                      const next = [...value];
                      next[index] = { ...image, altTh: event.target.value };
                      onChange(next);
                    }}
                    placeholder="Alt TH"
                    className="input h-8 py-0 text-[11px]"
                    maxLength={200}
                  />
                  <input
                    value={image.altEn}
                    onChange={(event) => {
                      const next = [...value];
                      next[index] = { ...image, altEn: event.target.value };
                      onChange(next);
                    }}
                    placeholder="Alt EN"
                    className="input h-8 py-0 text-[11px]"
                    maxLength={200}
                  />
                </div>
              </div>
              <div className="mt-2 flex items-center justify-between text-[11px]">
                <div className="flex gap-2">
                  <button type="button" onClick={() => move(index, -1)} disabled={index === 0} className="text-muted hover:text-charcoal disabled:opacity-30">
                    ↑
                  </button>
                  <button type="button" onClick={() => move(index, 1)} disabled={index === value.length - 1} className="text-muted hover:text-charcoal disabled:opacity-30">
                    ↓
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => onChange(value.filter((_, i) => i !== index))}
                  className="flex items-center gap-1 text-danger"
                >
                  <IconTrash size={12} />
                  {t("common.delete")}
                </button>
              </div>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
