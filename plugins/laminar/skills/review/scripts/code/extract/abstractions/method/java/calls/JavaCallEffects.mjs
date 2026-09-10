import { GenericCallEffects } from "../../generic/calls/GenericCallEffects.mjs";

export class JavaCallEffects extends GenericCallEffects {
  language = "java";
  ambientSources = [
    /\b(LocalDate|LocalDateTime|LocalTime|ZonedDateTime|OffsetDateTime|Instant)\.now\s*\(/, /\bSystem\.(currentTimeMillis|nanoTime)\s*\(/,
    /\bClock\.system/, /\bSystem\.getenv\s*\(/, /\bMath\.random\s*\(/, /\bnew\s+Random\s*\(/, /\bUUID\.randomUUID\s*\(/,
  ];
  typesWhoseStaticCallsHideNothing = ["List", "Map", "Set", "Arrays", "Collections", "Collectors", "Stream", "Optional", "Objects",
    "String", "StringBuilder", "Integer", "Long", "Double", "Float", "Boolean", "Byte", "Short", "Character", "BigDecimal",
    "BigInteger", "Math", "Comparator", "Duration", "Period", "Assertions", "Assert", "Entry", "Files", "Paths", "Path"];
  inMemoryTypes = ["List", "ArrayList", "LinkedList", "Map", "HashMap", "LinkedHashMap", "TreeMap", "SortedMap", "NavigableMap", "ConcurrentHashMap", "ConcurrentMap", "EnumMap", "IdentityHashMap", "WeakHashMap", "Set", "HashSet", "LinkedHashSet", "TreeSet", "SortedSet", "EnumSet", "Collection", "Iterable", "Iterator", "ListIterator", "Stream", "IntStream", "LongStream", "DoubleStream", "Optional", "OptionalInt", "OptionalLong", "OptionalDouble", "String", "StringBuilder", "StringBuffer", "CharSequence", "Collections", "Arrays", "Objects", "Deque", "ArrayDeque", "Queue", "PriorityQueue", "Stack", "Vector", "Multimap", "ImmutableList", "ImmutableMap", "ImmutableSet", "Pair", "Triple", "Entry", "Tuple", "AtomicReference", "AtomicInteger", "AtomicLong", "BigDecimal", "BigInteger", "Integer", "Long", "Double", "Float", "Boolean", "Character", "Byte", "Short", "Number", "Object", "UUID", "Pattern", "Matcher", "Lock", "ReentrantLock"];
  inMemoryCallees = ["append", "replace", "split", "format", "clone", "startsWith", "endsWith", "indexOf", "contains", "containsKey", "trim", "toLowerCase", "toUpperCase", "substring", "size", "length", "isEmpty"];
  loopCallees = ["forEach", "forEachOrdered", "map", "flatMap", "filter", "reduce", "peek", "anyMatch", "allMatch", "noneMatch", "collect"];
  objectProtocolCallees = ["toString", "equals", "hashCode"];
}
