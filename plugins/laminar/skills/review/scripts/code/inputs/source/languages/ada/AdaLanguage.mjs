import { BODY_ENDS } from "../../forms/BodyEnds.mjs";
import { createForms } from "../../forms/CommentForms.mjs";

export const AdaLanguage = Object.freeze({
  diffDriver: "ada",
  extensions: [".ada", ".adb", ".ads"],
  commentForms: createForms(["--"]),
  bodyEnd: BODY_ENDS.CLOSING_MARK,
});
