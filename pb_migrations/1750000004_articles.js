/// <reference path="../pb_data/types.d.ts" />

migrate((app) => {
  const collection = new Collection({
    type: "base",
    name: "articles",
    listRule: "",
    viewRule: "",
    createRule: null,
    updateRule: null,
    deleteRule: null,
    fields: [
      { type: "text", name: "title", presentable: true, max: 2000 },
      { type: "text", name: "article_id", required: true, min: 1, max: 128 },
      { type: "text", name: "source_id", max: 200 },
      { type: "text", name: "url", max: 2000 },
      { type: "text", name: "language", max: 32 },
      { type: "text", name: "excerpt", max: 5000 },
      { type: "text", name: "text", max: 500000 },
      { type: "date", name: "published_at" },
      { type: "text", name: "host", max: 255 },
      { type: "number", name: "rank" },
      { type: "text", name: "copy_cluster_id", max: 200 },
      { type: "text", name: "topic_id", max: 200 },
      { type: "json", name: "outbound_links", maxSize: 2000000 },
      { type: "json", name: "credits", maxSize: 2000000 },
    ],
    indexes: [
      "CREATE UNIQUE INDEX idx_articles_article_id ON articles (article_id)",
    ],
  })
  app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("articles")
  app.delete(collection)
})
