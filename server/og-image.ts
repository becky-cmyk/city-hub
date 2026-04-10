import type { Express, Request, Response } from "express";
import satori from "satori";
import sharp from "sharp";
import path from "path";
import fs from "fs";
import { storage } from "./storage";
import { db } from "./db";
import { posts, publicUsers } from "@shared/schema";
import { eq } from "drizzle-orm";

const OG_WIDTH = 1200;
const OG_HEIGHT = 630;

const BRAND_PURPLE = "#6B21A8";
const BRAND_AMBER = "#F59E0B";
const BRAND_BG = "#1E1B2E";

let cachedFont: ArrayBuffer | null = null;

async function loadFont(): Promise<ArrayBuffer> {
  if (cachedFont) return cachedFont;
  const fontPath = path.resolve(
    process.cwd(),
    "node_modules",
    "@fontsource",
    "inter",
    "files",
    "inter-latin-400-normal.woff"
  );
  if (fs.existsSync(fontPath)) {
    cachedFont = fs.readFileSync(fontPath).buffer as ArrayBuffer;
    return cachedFont;
  }
  const resp = await fetch(
    "https://cdn.jsdelivr.net/fontsource/fonts/inter@latest/latin-400-normal.woff"
  );
  cachedFont = await resp.arrayBuffer();
  return cachedFont;
}

let cachedBoldFont: ArrayBuffer | null = null;

async function loadBoldFont(): Promise<ArrayBuffer> {
  if (cachedBoldFont) return cachedBoldFont;
  const fontPath = path.resolve(
    process.cwd(),
    "node_modules",
    "@fontsource",
    "inter",
    "files",
    "inter-latin-700-normal.woff"
  );
  if (fs.existsSync(fontPath)) {
    cachedBoldFont = fs.readFileSync(fontPath).buffer as ArrayBuffer;
    return cachedBoldFont;
  }
  const resp = await fetch(
    "https://cdn.jsdelivr.net/fontsource/fonts/inter@latest/latin-700-normal.woff"
  );
  cachedBoldFont = await resp.arrayBuffer();
  return cachedBoldFont;
}

function renderStars(rating: number): string {
  const full = Math.floor(rating);
  const half = rating - full >= 0.3;
  const stars: string[] = [];
  for (let i = 0; i < full; i++) stars.push("\u2605");
  if (half) stars.push("\u2606");
  return stars.join("");
}

function truncateText(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen - 1) + "\u2026";
}

function businessOgMarkup(data: {
  name: string;
  imageUrl?: string | null;
  rating?: string | null;
  reviewCount?: number | null;
  categoryName?: string | null;
  cityName: string;
  brandName?: string | null;
}) {
  const stars = data.rating ? renderStars(parseFloat(data.rating)) : "";
  const reviewText =
    data.rating && data.reviewCount
      ? `${data.rating} ${stars} (${data.reviewCount})`
      : "";

  return {
    type: "div",
    props: {
      style: {
        display: "flex",
        width: "100%",
        height: "100%",
        backgroundColor: BRAND_BG,
        position: "relative",
      },
      children: [
        data.imageUrl
          ? {
              type: "img",
              props: {
                src: data.imageUrl,
                style: {
                  position: "absolute",
                  top: 0,
                  left: 0,
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                  opacity: 0.3,
                },
              },
            }
          : null,
        {
          type: "div",
          props: {
            style: {
              display: "flex",
              flexDirection: "column",
              justifyContent: "flex-end",
              width: "100%",
              height: "100%",
              padding: "48px 56px",
              background:
                "linear-gradient(180deg, transparent 0%, rgba(30,27,46,0.85) 60%, rgba(30,27,46,0.95) 100%)",
            },
            children: [
              data.categoryName
                ? {
                    type: "div",
                    props: {
                      style: {
                        display: "flex",
                        marginBottom: "12px",
                      },
                      children: [
                        {
                          type: "div",
                          props: {
                            style: {
                              backgroundColor: BRAND_AMBER,
                              color: "#1a1a2e",
                              padding: "6px 16px",
                              borderRadius: "6px",
                              fontSize: "22px",
                              fontWeight: 700,
                            },
                            children: data.categoryName,
                          },
                        },
                      ],
                    },
                  }
                : null,
              {
                type: "div",
                props: {
                  style: {
                    fontSize: "52px",
                    fontWeight: 700,
                    color: "#ffffff",
                    lineHeight: 1.15,
                    marginBottom: "12px",
                  },
                  children: truncateText(data.name, 60),
                },
              },
              reviewText
                ? {
                    type: "div",
                    props: {
                      style: {
                        fontSize: "28px",
                        color: BRAND_AMBER,
                        marginBottom: "8px",
                      },
                      children: reviewText,
                    },
                  }
                : null,
              {
                type: "div",
                props: {
                  style: {
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginTop: "16px",
                  },
                  children: [
                    {
                      type: "div",
                      props: {
                        style: {
                          fontSize: "22px",
                          color: "rgba(255,255,255,0.7)",
                        },
                        children: data.cityName,
                      },
                    },
                    {
                      type: "div",
                      props: {
                        style: {
                          display: "flex",
                          alignItems: "center",
                          gap: "8px",
                        },
                        children: [
                          {
                            type: "div",
                            props: {
                              style: {
                                width: "12px",
                                height: "12px",
                                borderRadius: "50%",
                                backgroundColor: BRAND_PURPLE,
                              },
                            },
                          },
                          {
                            type: "div",
                            props: {
                              style: {
                                fontSize: "24px",
                                fontWeight: 700,
                                color: "rgba(255,255,255,0.9)",
                              },
                              children:
                                data.brandName || "CLT Metro Hub",
                            },
                          },
                        ],
                      },
                    },
                  ],
                },
              },
            ].filter(Boolean),
          },
        },
      ].filter(Boolean),
    },
  };
}

function eventOgMarkup(data: {
  title: string;
  imageUrl?: string | null;
  date: string;
  venue?: string | null;
  cityName: string;
  brandName?: string | null;
}) {
  return {
    type: "div",
    props: {
      style: {
        display: "flex",
        width: "100%",
        height: "100%",
        backgroundColor: BRAND_BG,
        position: "relative",
      },
      children: [
        data.imageUrl
          ? {
              type: "img",
              props: {
                src: data.imageUrl,
                style: {
                  position: "absolute",
                  top: 0,
                  left: 0,
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                  opacity: 0.3,
                },
              },
            }
          : null,
        {
          type: "div",
          props: {
            style: {
              display: "flex",
              flexDirection: "column",
              justifyContent: "flex-end",
              width: "100%",
              height: "100%",
              padding: "48px 56px",
              background:
                "linear-gradient(180deg, transparent 0%, rgba(30,27,46,0.85) 60%, rgba(30,27,46,0.95) 100%)",
            },
            children: [
              {
                type: "div",
                props: {
                  style: {
                    display: "flex",
                    marginBottom: "12px",
                  },
                  children: [
                    {
                      type: "div",
                      props: {
                        style: {
                          backgroundColor: BRAND_PURPLE,
                          color: "#ffffff",
                          padding: "6px 16px",
                          borderRadius: "6px",
                          fontSize: "22px",
                          fontWeight: 700,
                        },
                        children: "EVENT",
                      },
                    },
                  ],
                },
              },
              {
                type: "div",
                props: {
                  style: {
                    fontSize: "52px",
                    fontWeight: 700,
                    color: "#ffffff",
                    lineHeight: 1.15,
                    marginBottom: "12px",
                  },
                  children: truncateText(data.title, 60),
                },
              },
              {
                type: "div",
                props: {
                  style: {
                    fontSize: "26px",
                    color: BRAND_AMBER,
                    marginBottom: "4px",
                  },
                  children: data.date,
                },
              },
              data.venue
                ? {
                    type: "div",
                    props: {
                      style: {
                        fontSize: "22px",
                        color: "rgba(255,255,255,0.7)",
                        marginBottom: "4px",
                      },
                      children: data.venue,
                    },
                  }
                : null,
              {
                type: "div",
                props: {
                  style: {
                    display: "flex",
                    justifyContent: "flex-end",
                    marginTop: "16px",
                  },
                  children: [
                    {
                      type: "div",
                      props: {
                        style: {
                          display: "flex",
                          alignItems: "center",
                          gap: "8px",
                        },
                        children: [
                          {
                            type: "div",
                            props: {
                              style: {
                                width: "12px",
                                height: "12px",
                                borderRadius: "50%",
                                backgroundColor: BRAND_PURPLE,
                              },
                            },
                          },
                          {
                            type: "div",
                            props: {
                              style: {
                                fontSize: "24px",
                                fontWeight: 700,
                                color: "rgba(255,255,255,0.9)",
                              },
                              children:
                                data.brandName || "CLT Metro Hub",
                            },
                          },
                        ],
                      },
                    },
                  ],
                },
              },
            ].filter(Boolean),
          },
        },
      ].filter(Boolean),
    },
  };
}

function articleOgMarkup(data: {
  title: string;
  imageUrl?: string | null;
  authorName?: string | null;
  cityName: string;
  brandName?: string | null;
}) {
  return {
    type: "div",
    props: {
      style: {
        display: "flex",
        width: "100%",
        height: "100%",
        backgroundColor: BRAND_BG,
        position: "relative",
      },
      children: [
        data.imageUrl
          ? {
              type: "img",
              props: {
                src: data.imageUrl,
                style: {
                  position: "absolute",
                  top: 0,
                  left: 0,
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                  opacity: 0.3,
                },
              },
            }
          : null,
        {
          type: "div",
          props: {
            style: {
              display: "flex",
              flexDirection: "column",
              justifyContent: "flex-end",
              width: "100%",
              height: "100%",
              padding: "48px 56px",
              background:
                "linear-gradient(180deg, transparent 0%, rgba(30,27,46,0.85) 60%, rgba(30,27,46,0.95) 100%)",
            },
            children: [
              {
                type: "div",
                props: {
                  style: {
                    display: "flex",
                    marginBottom: "12px",
                  },
                  children: [
                    {
                      type: "div",
                      props: {
                        style: {
                          backgroundColor: BRAND_AMBER,
                          color: "#1a1a2e",
                          padding: "6px 16px",
                          borderRadius: "6px",
                          fontSize: "22px",
                          fontWeight: 700,
                        },
                        children: "ARTICLE",
                      },
                    },
                  ],
                },
              },
              {
                type: "div",
                props: {
                  style: {
                    fontSize: "52px",
                    fontWeight: 700,
                    color: "#ffffff",
                    lineHeight: 1.15,
                    marginBottom: "12px",
                  },
                  children: truncateText(data.title, 70),
                },
              },
              data.authorName
                ? {
                    type: "div",
                    props: {
                      style: {
                        fontSize: "24px",
                        color: "rgba(255,255,255,0.7)",
                        marginBottom: "4px",
                      },
                      children: `By ${data.authorName}`,
                    },
                  }
                : null,
              {
                type: "div",
                props: {
                  style: {
                    display: "flex",
                    justifyContent: "flex-end",
                    marginTop: "16px",
                  },
                  children: [
                    {
                      type: "div",
                      props: {
                        style: {
                          display: "flex",
                          alignItems: "center",
                          gap: "8px",
                        },
                        children: [
                          {
                            type: "div",
                            props: {
                              style: {
                                width: "12px",
                                height: "12px",
                                borderRadius: "50%",
                                backgroundColor: BRAND_PURPLE,
                              },
                            },
                          },
                          {
                            type: "div",
                            props: {
                              style: {
                                fontSize: "24px",
                                fontWeight: 700,
                                color: "rgba(255,255,255,0.9)",
                              },
                              children:
                                data.brandName || "CLT Metro Hub",
                            },
                          },
                        ],
                      },
                    },
                  ],
                },
              },
            ].filter(Boolean),
          },
        },
      ].filter(Boolean),
    },
  };
}

function pulseOgMarkup(data: {
  title: string;
  imageUrl?: string | null;
  authorName?: string | null;
  mediaType?: string | null;
  cityName: string;
  brandName?: string | null;
}) {
  const badgeLabel = data.mediaType === "reel" ? "REEL" : "POST";
  const badgeColor = data.mediaType === "reel" ? BRAND_PURPLE : BRAND_AMBER;
  const badgeTextColor = data.mediaType === "reel" ? "#ffffff" : "#1a1a2e";

  return {
    type: "div",
    props: {
      style: {
        display: "flex",
        width: "100%",
        height: "100%",
        backgroundColor: BRAND_BG,
        position: "relative",
      },
      children: [
        data.imageUrl
          ? {
              type: "img",
              props: {
                src: data.imageUrl,
                style: {
                  position: "absolute",
                  top: 0,
                  left: 0,
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                  opacity: 0.3,
                },
              },
            }
          : null,
        {
          type: "div",
          props: {
            style: {
              display: "flex",
              flexDirection: "column",
              justifyContent: "flex-end",
              width: "100%",
              height: "100%",
              padding: "48px 56px",
              background:
                "linear-gradient(180deg, transparent 0%, rgba(30,27,46,0.85) 60%, rgba(30,27,46,0.95) 100%)",
            },
            children: [
              {
                type: "div",
                props: {
                  style: {
                    display: "flex",
                    marginBottom: "12px",
                    gap: "12px",
                  },
                  children: [
                    {
                      type: "div",
                      props: {
                        style: {
                          backgroundColor: badgeColor,
                          color: badgeTextColor,
                          padding: "6px 16px",
                          borderRadius: "6px",
                          fontSize: "22px",
                          fontWeight: 700,
                        },
                        children: badgeLabel,
                      },
                    },
                  ],
                },
              },
              {
                type: "div",
                props: {
                  style: {
                    fontSize: "52px",
                    fontWeight: 700,
                    color: "#ffffff",
                    lineHeight: 1.15,
                    marginBottom: "12px",
                  },
                  children: truncateText(data.title, 70),
                },
              },
              data.authorName
                ? {
                    type: "div",
                    props: {
                      style: {
                        fontSize: "24px",
                        color: "rgba(255,255,255,0.7)",
                        marginBottom: "4px",
                      },
                      children: `By ${data.authorName}`,
                    },
                  }
                : null,
              {
                type: "div",
                props: {
                  style: {
                    display: "flex",
                    justifyContent: "flex-end",
                    marginTop: "16px",
                  },
                  children: [
                    {
                      type: "div",
                      props: {
                        style: {
                          display: "flex",
                          alignItems: "center",
                          gap: "8px",
                        },
                        children: [
                          {
                            type: "div",
                            props: {
                              style: {
                                width: "12px",
                                height: "12px",
                                borderRadius: "50%",
                                backgroundColor: BRAND_PURPLE,
                              },
                            },
                          },
                          {
                            type: "div",
                            props: {
                              style: {
                                fontSize: "24px",
                                fontWeight: 700,
                                color: "rgba(255,255,255,0.9)",
                              },
                              children:
                                data.brandName || "CLT Metro Hub",
                            },
                          },
                        ],
                      },
                    },
                  ],
                },
              },
            ].filter(Boolean),
          },
        },
      ].filter(Boolean),
    },
  };
}

function fallbackOgMarkup(data: {
  title: string;
  subtitle?: string;
  brandName?: string | null;
}) {
  return {
    type: "div",
    props: {
      style: {
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
        width: "100%",
        height: "100%",
        backgroundColor: BRAND_BG,
        padding: "48px 56px",
      },
      children: [
        {
          type: "div",
          props: {
            style: {
              display: "flex",
              alignItems: "center",
              gap: "12px",
              marginBottom: "32px",
            },
            children: [
              {
                type: "div",
                props: {
                  style: {
                    width: "20px",
                    height: "20px",
                    borderRadius: "50%",
                    backgroundColor: BRAND_PURPLE,
                  },
                },
              },
              {
                type: "div",
                props: {
                  style: {
                    fontSize: "32px",
                    fontWeight: 700,
                    color: "rgba(255,255,255,0.9)",
                  },
                  children: data.brandName || "CLT Metro Hub",
                },
              },
            ],
          },
        },
        {
          type: "div",
          props: {
            style: {
              fontSize: "52px",
              fontWeight: 700,
              color: "#ffffff",
              textAlign: "center",
              lineHeight: 1.2,
              marginBottom: "16px",
            },
            children: truncateText(data.title, 60),
          },
        },
        data.subtitle
          ? {
              type: "div",
              props: {
                style: {
                  fontSize: "24px",
                  color: BRAND_AMBER,
                  textAlign: "center",
                },
                children: data.subtitle,
              },
            }
          : null,
      ].filter(Boolean),
    },
  };
}

const ogImageCache = new Map<string, { buffer: Buffer; ts: number }>();
const OG_CACHE_TTL = 5 * 60 * 1000;

async function renderOgImage(markup: any): Promise<Buffer> {
  const [fontData, boldFontData] = await Promise.all([
    loadFont(),
    loadBoldFont(),
  ]);

  const svg = await satori(markup, {
    width: OG_WIDTH,
    height: OG_HEIGHT,
    fonts: [
      {
        name: "Inter",
        data: fontData,
        weight: 400,
        style: "normal" as const,
      },
      {
        name: "Inter",
        data: boldFontData,
        weight: 700,
        style: "normal" as const,
      },
    ],
  });

  const pngBuffer = await sharp(Buffer.from(svg)).png({ quality: 85 }).toBuffer();
  return pngBuffer;
}

function resolveImageUrl(imageUrl: string | null | undefined, baseUrl: string): string | null {
  if (!imageUrl) return null;
  if (imageUrl.startsWith("http")) return imageUrl;
  return `${baseUrl}${imageUrl.startsWith("/") ? "" : "/"}${imageUrl}`;
}

export function registerOgImageRoutes(app: Express) {
  app.get("/api/og-image/:type/:slug", async (req: Request, res: Response) => {
    const type = req.params.type as string;
    const slug = req.params.slug as string;
    const cacheKey = `${type}:${slug}`;

    const cached = ogImageCache.get(cacheKey);
    if (cached && Date.now() - cached.ts < OG_CACHE_TTL) {
      res.set({
        "Content-Type": "image/png",
        "Cache-Control": "public, max-age=300, s-maxage=3600",
      });
      return res.send(cached.buffer);
    }

    try {
      const city = await storage.getCityBySlug("charlotte");
      if (!city) {
        return res.status(404).send("City not found");
      }

      const baseUrl =
        process.env.APP_PUBLIC_URL ||
        (process.env.REPLIT_DEV_DOMAIN
          ? `https://${process.env.REPLIT_DEV_DOMAIN}`
          : `http://127.0.0.1:${process.env.PORT || "5000"}`);

      let markup: any;

      if (type === "business") {
        const biz = await storage.getBusinessBySlug(city.id, slug);
        if (!biz) return res.status(404).send("Business not found");

        const categories = await storage.getAllCategories();
        const category = biz.categoryIds?.length
          ? categories.find((c) => biz.categoryIds.includes(c.id))
          : undefined;

        markup = businessOgMarkup({
          name: biz.name,
          imageUrl: resolveImageUrl(biz.imageUrl, baseUrl),
          rating: biz.googleRating,
          reviewCount: biz.googleReviewCount,
          categoryName: category?.name || null,
          cityName: city.name,
          brandName: city.brandName,
        });
      } else if (type === "event") {
        const event = await storage.getEventBySlug(city.id, slug);
        if (!event) return res.status(404).send("Event not found");

        const dateStr = new Date(event.startDateTime).toLocaleDateString(
          "en-US",
          {
            weekday: "long",
            month: "long",
            day: "numeric",
            year: "numeric",
          }
        );

        markup = eventOgMarkup({
          title: event.title,
          imageUrl: resolveImageUrl(event.imageUrl, baseUrl),
          date: dateStr,
          venue: event.locationName || null,
          cityName: city.name,
          brandName: city.brandName,
        });
      } else if (type === "article") {
        const article = await storage.getArticleBySlug(city.id, slug);
        if (!article) return res.status(404).send("Article not found");

        let authorName: string | null = null;
        if (article.authorId) {
          const author = await storage.getAuthorById(article.authorId);
          if (author) authorName = author.name;
        }

        markup = articleOgMarkup({
          title: article.title,
          imageUrl: resolveImageUrl(article.imageUrl, baseUrl),
          authorName,
          cityName: city.name,
          brandName: city.brandName,
        });
      } else if (type === "pulse") {
        const [post] = await db
          .select()
          .from(posts)
          .where(eq(posts.id, slug))
          .limit(1);
        if (!post) return res.status(404).send("Post not found");

        let authorName: string | null = null;
        if (post.authorUserId) {
          const [user] = await db
            .select()
            .from(publicUsers)
            .where(eq(publicUsers.id, post.authorUserId))
            .limit(1);
          if (user) authorName = user.displayName || user.email;
        }

        const imageUrl = post.coverImageUrl || post.videoThumbnailUrl || (post.mediaUrls?.length ? post.mediaUrls[0] : null);

        markup = pulseOgMarkup({
          title: post.title,
          imageUrl: resolveImageUrl(imageUrl, baseUrl),
          authorName,
          mediaType: post.mediaType,
          cityName: city.name,
          brandName: city.brandName,
        });
      } else {
        markup = fallbackOgMarkup({
          title: slug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
          subtitle: `Discover on ${city.brandName || city.name}`,
          brandName: city.brandName,
        });
      }

      const buffer = await renderOgImage(markup);

      if (ogImageCache.size > 300) ogImageCache.clear();
      ogImageCache.set(cacheKey, { buffer, ts: Date.now() });

      res.set({
        "Content-Type": "image/png",
        "Cache-Control": "public, max-age=300, s-maxage=3600",
      });
      res.send(buffer);
    } catch (err) {
      console.error("[OG-IMAGE] Error generating image:", err);
      res.status(500).send("Error generating OG image");
    }
  });
}

export function getOgImageUrl(baseUrl: string, type: string, slug: string): string {
  return `${baseUrl}/api/og-image/${type}/${encodeURIComponent(slug)}`;
}
