// A simple test file to verify the FSRS algorithm in the console.
// To run this, open the browser's developer console and paste the content of this file.
// Or load it in a test HTML file: <script type="module" src="test-fsrs.js"></script>

import { FSRS, RATING } from './src/core/FSRS.js';
import { Progress } from './src/core/Progress.js';

console.log("--- FSRS Test Suite ---");

// 1. Initialize FSRS
const fsrs = new FSRS();
console.log("FSRS instance created.");

// 2. Test Case 1: First review of a brand new card
console.log("\n--- Test Case 1: New card, rated 'EASY' ---");
let progress1 = null; // Represents a new card
progress1 = fsrs.rate(progress1, RATING.EASY);

console.log("Resulting Progress:", progress1);
if (progress1.stability > 0 && progress1.difficulty > 0 && progress1.dueDate > Date.now()) {
    console.log("✅ PASSED: New card was successfully initialized.");
} else {
    console.error("❌ FAILED: New card initialization failed.");
}

// 3. Test Case 2: Second review of the same card, rated 'HARD'
console.log("\n--- Test Case 2: Existing card, rated 'HARD' ---");
// Let's assume some time has passed, but it's still before the due date.
let progress2 = fsrs.rate(progress1, RATING.HARD);

console.log("Resulting Progress:", progress2);
if (progress2.stability > progress1.stability) {
    console.log("✅ PASSED: Stability correctly increased (or changed).");
} else {
    console.error("❌ FAILED: Stability did not update as expected.");
}
if (progress2.reviews.length === 2) {
    console.log("✅ PASSED: Review history was correctly updated.");
} else {
    console.error("❌ FAILED: Review history was not updated.");
}

// 4. Test Case 3: Review of an existing card, rated 'FORGOT'
console.log("\n--- Test Case 3: Existing card, rated 'FORGOT' ---");
let progress3 = fsrs.rate(progress2, RATING.FORGOT);
console.log("Resulting Progress:", progress3);
if (progress3.stability < progress2.stability) {
    console.log("✅ PASSED: Stability correctly decreased after forgetting.");
} else {
    console.error("❌ FAILED: Stability did not decrease after forgetting.");
}
if (Math.round(progress3.dueDate - progress3.lastReview) === 1 * 24 * 60 * 60 * 1000) {
    console.log("✅ PASSED: Interval was reset to 1 day.");
} else {
    console.error(`❌ FAILED: Interval was not reset to 1 day. It is ${Math.round(progress3.dueDate - progress3.lastReview) / (24*60*60*1000)} days.`);
}


console.log("\n--- FSRS Test Suite Finished ---");
