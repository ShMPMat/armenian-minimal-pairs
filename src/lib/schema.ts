export type PairItem = {
  word: string;
  ipa: string;
  meaningEnglish: string;
  audio: string;
};

export type PairSet = {
  id: number;
  phonemeGroup: string;
  items: PairItem[];
};

export type TrainerData = {
  sets: PairSet[];
};

export type CsvRow = {
  phonemeGroup: string;
  setId: number;
  word: string;
  ipa: string;
  meaningEnglish: string;
};
