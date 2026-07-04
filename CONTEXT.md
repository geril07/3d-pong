# 3D Pong Arena

Language for the 3D Pong Arena game design. These terms define the gameplay concepts used across planning, issues, and implementation.

## Language

**Drag-Hit**:
A powered return caused by paddle movement at the moment of ball contact. Hit strength comes from current or recent paddle velocity, not from stored charge.
_Avoid_: Charge hit, charge meter, hold to power up

**Buffer Zone**:
A forgiving interaction area around the paddle where the player can manage position before contact. The buffer zone gives room to perform Drag-Hits, but it does not hit the ball by itself.
_Avoid_: Charge zone, auto-hit zone

**Paddle Movement Area**:
The constrained area where the player paddle can move left/right and up/down near the player side. The paddle is not free-roaming in the arena and does not move forward/backward in the first playable design.
_Avoid_: Paddle movement volume, full 3D movement

**Bounded 3D Ball Movement**:
Ball movement across arena depth, width, and height, with readable arcade limits. The ball can bounce off side walls, floor, and ceiling rather than staying on a flat plane.
_Avoid_: Flat-plane ball movement, realistic table tennis physics

**Scoring Plane**:
The invisible back boundary behind a player's side. A point is scored only when the ball crosses this plane, allowing late recovery hits before the ball fully gets past the player.
_Avoid_: Paddle line, buffer boundary, miss line

**Forgiving Hitbox**:
A configurable paddle collision volume that is slightly larger than the visible paddle mesh. It exists to make fast 3D play readable and fair, not to create an invisible auto-defense area.
_Avoid_: Invisible wall, auto-save zone
