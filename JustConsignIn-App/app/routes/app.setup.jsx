import { useFetcher } from "react-router";
import { authenticate } from "../shopify.server";
import { ensureMetaobjectsInstalled } from "../metaobjects.server";

export const action = async ({ request }) => {
  const { admin, session } = await authenticate.admin(request);
  const result = await ensureMetaobjectsInstalled(admin, session.shop);
  return result;
};

export default function Setup() {
  const fetcher = useFetcher();
  const isRunning = fetcher.state !== "idle";
  const result = fetcher.data;

  return (
    <div style={{ maxWidth: 640, margin: "40px auto", padding: "0 20px", fontFamily: "system-ui, sans-serif" }}>
      <h1 style={{ fontSize: 22, marginBottom: 6 }}>Setup</h1>
      <p style={{ color: "#666", marginBottom: 24 }}>
        Creates the Consignment Item metaobject definition this app needs.
        Safe to run more than once.
      </p>

      <button
        type="button"
        disabled={isRunning}
        onClick={() => fetcher.submit({}, { method: "post" })}
        style={{
          background: "#1D5FA8",
          color: "#fff",
          border: "none",
          borderRadius: 8,
          padding: "12px 20px",
          fontSize: 14,
          fontWeight: 600,
          cursor: isRunning ? "default" : "pointer",
          opacity: isRunning ? 0.6 : 1,
        }}
      >
        {isRunning ? "Installing…" : "Install / Repair Metaobjects"}
      </button>

      {result?.ok && (
        <div style={{ marginTop: 16, padding: 12, background: "#E4EEF9", color: "#143F73", borderRadius: 8, fontSize: 14 }}>
          Metaobjects installed successfully.
        </div>
      )}
      {result && !result.ok && (
        <div style={{ marginTop: 16, padding: 12, background: "#FEE4E2", color: "#B42318", borderRadius: 8, fontSize: 14 }}>
          Something went wrong: {result.errors?.[0]?.message || "Unknown error"}
        </div>
      )}
    </div>
  );
}
