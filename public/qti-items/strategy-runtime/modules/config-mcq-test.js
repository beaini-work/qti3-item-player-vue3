/**
 * Configuration module for MCQ strategy test
 * This demonstrates the configuration module approach (Option 1 from the design)
 */
define([], function() {
  return {
    version: "1.0",
    strategy: "mcq",
    props: {
      prompt: "Which of the following are prime numbers?",
      choices: [
        { id: "c1", text: "2" },
        { id: "c2", text: "3" },
        { id: "c3", text: "4" },
        { id: "c4", text: "5" },
        { id: "c5", text: "6" },
        { id: "c6", text: "7" },
        { id: "c7", text: "8" },
        { id: "c8", text: "9" }
      ],
      correct: ["c1", "c2", "c4", "c6"], // 2, 3, 5, 7 are prime
      multi: true
    },
    ui: {
      shuffle: false  // Set to true to randomize choice order
    }
  };
});
