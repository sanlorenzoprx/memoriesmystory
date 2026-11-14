export type HumanCertainty = "stated" | "uncertain" | "unknown";
export type PersonReference = {
  label: string;
  notes: string;
  dateText: string;
  datePrecision: "known" | "approximate" | "unknown";
  memoryIds: string[];
};
export type RelationshipReference = {
  fromId: string;
  toId: string;
  label: string;
  certainty: HumanCertainty;
  type: "relationship" | "same_person";
};
export type PeopleRecord = {
  id: string;
  archiveId: string;
  kind: "person" | "relationship";
  document: PersonReference | RelationshipReference;
  active: boolean;
  version: number;
  authorId: string;
};
