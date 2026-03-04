# HALMAL-ITSO Project Blueprint

## Overview
HALMAL-ITSO is a modern React application integrated with Firebase, designed for open discussion and community interaction. It features a unique "debate" and "any talk" structure where users can share their thoughts and engage with others.

## Project Progress & Current Features
- **Firebase Integration**: Firestore for posts and user data, Storage for profile images.
- **Main Features**:
  - `AnyTalkList`, `LatestTalkList`, `BestTalkList`, `FriendTalkList`: Various views for exploring posts.
  - `DiscussionView`: A detailed view for a single topic and its related discussions (left/right sides).
  - `CreatePostBox`: Allows users to create new topics.
  - `MyPage`: User profile management, personality cards, and activity tracking.
- **MyPage Components**:
  - `MyProfileCard`: Displays user level, bio, and handles avatar updates.
  - `MyContentTabs`: Manages user posts, comments, and friends list.
  - `Personality Cards`: Interactive slots to showcase user personality (currently partially integrated).

## Proposed Step 4: React App Integration (MyPage.tsx)
The goal of this step is to finalize the MyPage functionality and ensure all interactive elements are correctly synchronized with the Firebase backend.

### Detailed Plan & Actionable Steps
1. **Finalize Personality Cards Synchronization**
   - Ensure the `personalityCards` in `MyPage.tsx` correctly reflect the state in Firestore.
   - Implement real-time updates for these cards so changes are immediately visible.
   - (Optional) Refine the locking logic for slots 2 and 3 based on user level or other criteria if needed.

2. **Implement Real Friend Management in `MyContentTabs.tsx`**
   - Replace placeholder alerts for `handleUnfriend` and `handleBlock` with actual Firestore operations.
   - Update the `friendList` in the `users/user_heukmooyoung` document.
   - Ensure the friend list UI updates immediately after unfriend/block actions.

3. **Refine Profile Management in `MyProfileCard.tsx`**
   - Verify the image upload flow to Firebase Storage is robust.
   - Ensure level calculation (currently based on `friendCount`) is consistent across the app.

4. **Consistency & Code Cleanup**
   - Ensure all MyPage related components follow the "200 lines rule" by keeping them modular.
   - Standardize error handling for all Firestore updates.
   - Ensure the hardcoded user ID `user_heukmooyoung` is handled consistently (or move to a context if planned for later).

---
*Updated on 2026-03-03*
