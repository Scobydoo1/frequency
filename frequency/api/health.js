/* GET /api/health → { ok: true, persisted: boolean }
 * persisted=true means the Blob store is connected and real messages survive.
 * The intro screen renders this as "broadcast: live" vs "broadcast: echo". */
export default function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.status(200).json({
    ok: true,
    persisted: !!process.env.BLOB_READ_WRITE_TOKEN,
  });
}
