export type Difficulty = "easy" | "medium" | "hard";
export type Budget = "low" | "medium" | "high";
export type Mode = "feed" | "explore" | "tournament";
export type Appetite = "any" | "healthy" | "hearty";
export type DishStyle = "healthy" | "hearty";
export type Protein = "chicken" | "pork" | "beef" | "fish" | "veg" | "other";
export type ReactionKind = "no" | "skip" | "yes" | "love";
export type DedupeRelation = "sameDish" | "variantOf" | "unrelated";

export type Dish = {
  id: string;
  canonicalName: string;
  originalName?: string;
  aliases: string[];
  cuisine: string;
  categories: string[];
  description: string;
  imageUrl?: string;
  ingredients: string[];
  originalIngredients: string[];
  allergens: string[];
  preparationMinutes?: number;
  difficulty?: Difficulty;
  budget?: Budget;
  style?: DishStyle;
  protein?: Protein;
  isNew?: boolean;
  recipeIds: string[];
  source: string;
  sourceId: string;
  sourceUrl?: string;
  imageLicense?: string;
  attribution?: string;
};

export type Recipe = {
  id: string;
  dishId: string;
  title: string;
  ingredients: string[];
  measures: string[];
  instructions?: string[];
  sourceUrl: string;
  language?: string;
};

export type Catalog = {
  version: number;
  generatedAt: string;
  source: string;
  attribution: string;
  dishes: Dish[];
  recipes: Recipe[];
};

export type Constraints = {
  allergens: string[];
  excludedIngredients: string[];
  haveIngredients: string[];
  wantedIngredients: string[];
  excludedCuisines: string[];
  /** Empty means any cuisine; otherwise the dish cuisine must be in the list. */
  selectedCuisines: string[];
  excludedCategories: string[];
  selectedCategories: string[];
  maxMinutes?: number;
  budget?: Budget;
  appetite: Appetite;
  vegetarian: boolean;
  vegan: boolean;
  avoidRecent: boolean;
};

export type RankingWeights = {
  wp: number;
  wc: number;
  wn: number;
  wv: number;
  wr: number;
};

export type TasteProfile = {
  cuisineScores: Record<string, number>;
  categoryScores: Record<string, number>;
  ingredientScores: Record<string, number>;
  lovedDishIds: string[];
  seenDishIds: string[];
  /** Newest-first ring of recently shown cards; used for rotation cooldown. */
  recentShownIds: string[];
  difficultyBias: number;
  noveltyHunger: number;
  exploreShare: number;
  weights: RankingWeights;
};

export type Reaction = {
  dishId: string;
  kind: ReactionKind;
  at: number;
};

export type Comparison = {
  leftId: string;
  rightId: string;
  winnerId: string | null;
  skipped: boolean;
  at: number;
};

export type TournamentState = {
  remaining: string[];
  current: [string, string] | null;
  bye: string | null;
  winners: string[];
  round: number;
  history: Comparison[];
  undoStack: TournamentState[];
};

export type Session = {
  id: string;
  mode: Mode;
  constraints: Constraints;
  deck: string[];
  index: number;
  reactions: Reaction[];
  tournament: TournamentState | null;
  createdAt: number;
  updatedAt: number;
  endedAt?: number;
  winnerId?: string;
  runnerUpIds: string[];
  earlyFinish: boolean;
};

export type Favorite = {
  dishId: string;
  savedAt: number;
};

export type SessionSummary = {
  id: string;
  mode: Mode;
  winnerId?: string;
  endedAt: number;
  viewed: number;
  comparisons: number;
};

export type ReportObservation = {
  kind: "fact" | "hypothesis";
  text: string;
};

export type SessionReport = {
  winnerId?: string;
  alternativeIds: string[];
  viewed: number;
  likes: number;
  loves: number;
  comparisons: number;
  cuisines: { name: string; count: number }[];
  categories: { name: string; count: number }[];
  newInteresting: string[];
  observations: ReportObservation[];
};

export interface DishProvider {
  search(query: string): Promise<Dish[]>;
  getById(id: string): Promise<Dish | null>;
  getCategories(): Promise<string[]>;
  getCuisines(): Promise<string[]>;
  all(): Promise<Dish[]>;
}
