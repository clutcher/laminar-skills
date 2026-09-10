import { GenericMethodRoleFinder } from "../../generic/GenericMethodRoleFinder.mjs";
import { TestCodeMarks } from "../../generic/testing/TestCodeMarks.mjs";

export class JvmMockitoMethodRoleFinder extends GenericMethodRoleFinder {
  family = "jvm";
  framework = "mockito";
  dependencyLinePatterns = [/\bmockito\b/, /\bspring-boot-starter-test\b/];
  frameworkMarkPatterns = [/^\s*import\s+(?:static\s+)?org\.mockito\./, /@(?:Mock|InjectMocks|Spy|Captor|MockBean|MockitoBean|SpyBean)\b/, /\bMockito\s*\./];
  testCodeMarks = new TestCodeMarks({
    interactionAssertions: [/\bverify\s*\(/, /\bverifyNoMoreInteractions\s*\(/, /\bverifyZeroInteractions\s*\(/, /\btimes\s*\(\s*\d/, /\bnever\s*\(\s*\)/],
    partialSubstitutes: [/(?<![\w$])spy\s*\(/, /@Spy\b/, /\bthenCallRealMethod\b/, /\bCALLS_REAL_METHODS\b/],
    substitutesReturningSubstitutes: [/\bRETURNS_DEEP_STUBS\b/, /\bwhen\s*\(\s*[\w$]+(?:\s*\.\s*[\w$]+\s*\([^()]*\)){2,}/, /\b(?:thenReturn|doReturn)\s*\(\s*(?:Mockito\s*\.\s*)?mock\s*\(/, /\b(?:thenReturn|doReturn)\s*\(\s*(?:mock[A-Z]\w*|\w+Mock)\s*\)/],
  });
}
