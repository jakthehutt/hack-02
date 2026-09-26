/// <reference path="../pb_data/types.d.ts" />

migrate((app) => {
  const collection = new Collection({
    type: "base",
    name: "frames",
    listRule: "",
    viewRule: "",
    createRule: null,
    updateRule: null,
    deleteRule: null,
    fields: [
      { type: "text", name: "label", presentable: true, max: 500 },
      { type: "text", name: "frame_id", required: true, min: 1, max: 200 },
      { type: "text", name: "version", max: 64 },
      { type: "text", name: "kind", max: 32 },
      { type: "text", name: "pattern", max: 10000 },
      { type: "text", name: "target", max: 200 },
      { type: "text", name: "euvsdisinfo_id", max: 200 },
      { type: "text", name: "status", max: 32 },
    ],
    indexes: [
      "CREATE UNIQUE INDEX idx_frames_frame_id ON frames (frame_id)",
    ],
  })
  app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("frames")
  app.delete(collection)
})
