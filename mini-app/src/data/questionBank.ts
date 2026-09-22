export type Question = {
  id: string;
  text: string;
  options: string[];
  correctAnswers: number[];
  xp: number;
  hasCases?: boolean;
};

export const QUESTION_BANK: Question[] = [
  { id: 'plants-001', text: 'Which part of a plant usually absorbs water and minerals from the soil?', options: ['Leaf', 'Root', 'Flower'], correctAnswers: [1], xp: 10 },
  { id: 'plants-002', text: 'Which process allows green plants to make food using light?', options: ['Photosynthesis', 'Respiration', 'Germination'], correctAnswers: [0], xp: 10 },
  { id: 'plants-003', text: 'Which of these is a part of a typical flower?', options: ['Petal', 'Stamen', 'Root'], correctAnswers: [0, 1], xp: 15 },
  { id: 'plants-004', text: 'Which statement about roots is correct?', options: ['They can anchor a plant', 'They always grow above the soil', 'They can absorb water'], correctAnswers: [0, 2], xp: 15 },
  { id: 'plants-005', text: 'Which of these is a type of plant tissue?', options: ['Xylem', 'Granite', 'Glass'], correctAnswers: [0], xp: 10 },
  { id: 'nature-001', text: 'Which of these is a natural body of standing water?', options: ['Pond', 'Bridge', 'Path'], correctAnswers: [0], xp: 10 },
  { id: 'nature-002', text: 'Which of these can be considered living parts of a garden?', options: ['Tree', 'Flower', 'Rock'], correctAnswers: [0, 1], xp: 15 },
  { id: 'nature-003', text: 'Which items can commonly provide shade in a garden?', options: ['Tree', 'Lamp', 'Large bush'], correctAnswers: [0, 2], xp: 15 },
  { id: 'general-001', text: 'Which option is NOT a living organism?', options: ['Mushroom', 'Rock', 'Tree'], correctAnswers: [1], xp: 10 },
  { id: 'general-002', text: 'Which of these can be used to describe something made of stone?', options: ['Rocky', 'Wooden', 'Stony'], correctAnswers: [0, 2], xp: 15 }
];
