import type { RecipeMedia } from "../types";
import { handleImageError } from "../lib/image";

export function RecipeMediaBlock({ media }: { media: RecipeMedia[] }) {
  if (!media.length) {
    return (
      <div className="recipe-media-placeholder" role="img" aria-label="图文视频占位">
        <span>📷 图文 / 视频教学即将上线</span>
      </div>
    );
  }
  return (
    <div className="recipe-media-list">
      {media.map((item, idx) =>
        item.type === "image" ? (
          <figure key={idx}>
            <img src={item.url} alt={item.caption ?? ""} loading="lazy" onError={handleImageError} />
            {item.caption ? <figcaption>{item.caption}</figcaption> : null}
          </figure>
        ) : (
          // Caption lives OUTSIDE <video> (a <p> inside <video> is invalid) — R13.
          <figure key={idx} className="recipe-video">
            <video src={item.url} controls preload="metadata" />
            {item.caption ? <figcaption>{item.caption}</figcaption> : null}
          </figure>
        ),
      )}
    </div>
  );
}
