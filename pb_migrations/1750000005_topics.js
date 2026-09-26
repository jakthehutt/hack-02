/// <reference path="../pb_data/types.d.ts" />

migrate((app) => {
  const collection = new Collection({
    type: "base",
    name: "topics",
    listRule: "",
    viewRule: "",
    createRule: null,
    updateRule: null,
    deleteRule: null,
    fields: [
      { type: "text", name: "label", presentable: true, max: 500 },
      { type: "text", name: "topic_id", required: true, min: 1, max: 200 },
      { type: "text", name: "description", max: 5000 },
      { type: "text", name: "origin_source_id", max: 200 },
      { type: "text", name: "origin_article_id", max: 128 },
      { type: "text", name: "origin_rule", max: 200 },
      { type: "date", name: "window_start" },
      { type: "date", name: "window_end" },
      { type: "json", name: "entities", maxSize: 2000000 },
      { type: "json", name: "members", maxSize: 2000000 },
      { type: "json", name: "downstream_source_ids", maxSize: 2000000 },
    ],
    indexes: [
      "CREATE UNIQUE INDEX idx_topics_topic_id ON topics (topic_id)",
    ],
  })
  app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("topics")
  app.delete(collection)
})
