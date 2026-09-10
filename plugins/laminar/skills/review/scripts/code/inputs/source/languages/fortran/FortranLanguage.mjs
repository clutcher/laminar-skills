import { BODY_ENDS } from "../../forms/BodyEnds.mjs";
import { createForms } from "../../forms/CommentForms.mjs";

export const FortranLanguage = Object.freeze({
  diffDriver: "fortran",
  extensions: [".f", ".f90"],
  commentForms: createForms(["!"]),
  bodyEnd: BODY_ENDS.CLOSING_MARK,
});
