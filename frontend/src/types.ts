export type Evidence = {
  value: string;
  quote: string;
  page: number;
  document: string;
  document_id: number;
};
export type SupplierCase = {
  id: number;
  name: string;
  status: string;
  ready: boolean;
  missing_documents: string[];
  fields: Record<
    string,
    { label: string; state: string; value: string; evidence: Evidence[] }
  >;
  documents: {
    id: number;
    name: string;
    kind: string;
    mode: string;
    pages: string[];
  }[];
  events: {
    actor: string;
    action: string;
    details: { reason?: string; note?: string };
    at: string;
  }[];
};
