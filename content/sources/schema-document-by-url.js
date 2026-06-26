import axios from "axios";
import { ARC_ACCESS_TOKEN, CONTENT_BASE } from "fusion:environment";

const params = [
  {
    displayName: "URL",
    name: "url",
    type: "text",
  },
  {
    displayName: "Schema Name",
    name: "schema_name",
    type: "text",
  },
  {
    displayName: "Website",
    name: "website",
    type: "site",
  },
];

const fetch = ({ url, schema_name, website }, { cachedCall }) => {
  if (!url || !schema_name || !website) {
    return "";
  }

  const urlSearch = new URLSearchParams({
    url: url.trim(),
    schema_name: schema_name.trim(),
    website,
  });

  return axios({
    url: `${CONTENT_BASE}/content/v5/search/schemas/by-url?${urlSearch.toString()}`,
    headers: {
      "content-type": "application/json",
      Authorization: `Bearer ${ARC_ACCESS_TOKEN}`,
    },
    method: "GET",
  })
    .then(({ data }) => {
      if (!data) {
        const error = new Error("Document not found");
        error.statusCode = 404;
        throw error;
      }
      return data;
    });
};

export default {
  fetch,
  params,
  ttl: 300,
};
