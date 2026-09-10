import { isAWordOfTheLanguage } from "./LanguageWords.mjs";
import { isAnEverydayName } from "./EverydayNames.mjs";

export const isALanguageWordOrAnEverydayName = word => isAWordOfTheLanguage(word) || isAnEverydayName(word);
