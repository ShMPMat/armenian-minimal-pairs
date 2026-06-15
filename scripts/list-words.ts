// Ensure the script reads the correct CSV file
const fileName = "data/armenian_minimal_pairs.csv";

try {
  // Read the content of the CSV file
  const csvText = await Deno.readTextFile(fileName);
  
  // Split into individual lines
  const lines = csvText.split(/\r?\n/);
  
  // Use a Map to preserve order and group words by Set_ID
  const sets = new Map<string, string[]>();
  
  // Skip the header row (index 0) and iterate through each line
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue; // Skip empty rows
    
    // Split columns by comma
    const columns = line.split(",");
    const setId = columns[1]; // Column 1: Set_ID
    const word = columns[2];  // Column 2: Word
    
    if (!sets.has(setId)) {
      sets.set(setId, []);
    }
    sets.get(setId)!.push(word);
  }
  
  // Print words from all sets, one set per line
  for (const [_, words] of sets) {
    console.log(words.join(" "));
  }
} catch (error) {
  console.error("Error reading or processing the file:", error.message);
}
