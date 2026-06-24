import { ARC_ACCESS_TOKEN, CONTENT_BASE } from "fusion:environment";

const params = [
  {
    displayName: "URL",
    name: "url",
    type: "text",
  },
  {
    displayName: "Schema Name",
    name: "schemaName",
    type: "text",
  },
];

const fetch = async ({ url, schemaName, "arc-site": website }, { arcSite }) => {
  if (!url || !schemaName) {
    return "";
  }

  const siteValue = website || arcSite;
  if (!siteValue) {
    return "";
  }

  const urlSearch = new URLSearchParams({
    url: url.trim(),
    schema_name: schemaName.trim(),
    website: siteValue,
  });

  const res = await globalThis.fetch(
    `${CONTENT_BASE}/api/v5/search/schemas/by-url?${urlSearch.toString()}`,
    {
      method: "GET",
      headers: {
        "content-type": "application/json",
        Authorization: `Bearer ${ARC_ACCESS_TOKEN}`,
      },
    }
  );

  const data = await res.json();

  if (!data) {
    const error = new Error("Document not found");
    error.statusCode = 404;
    throw error;
  }

  return data;
};

export default {
  fetch,
  params,
  ttl: 300,
};
