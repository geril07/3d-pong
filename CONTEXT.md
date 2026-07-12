# 3D Pong Arena

Language for the 3D Pong Arena game design. These terms define the gameplay concepts used across planning, issues, and implementation.

## Language

**Drag-Hit**:
A powered return caused by paddle movement at the moment of ball contact. Hit strength comes from current paddle velocity on the player's movement plane, not from stored charge.
_Avoid_: Charge hit, charge meter, hold to power up

**Buffer Zone**:
A historical readability term for extra space around the paddle before contact. In the current playable version it is not an active runtime mechanic or collider.
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
A configurable paddle collision volume that can be larger than the visible paddle mesh. The current default is enabled with a small assist in width, height, and depth to make contacts feel more reliable without turning the paddle into a wall.
_Avoid_: Invisible wall, auto-save zone

**Rally Tempo Ramp**:
A configurable speed increase applied after each paddle hit within a rally. It raises pressure over longer exchanges, resets after a point, and stays bounded by the ball speed limits.
_Avoid_: Hidden timer, sudden difficulty spike

**Ball Speed**:
A player-selected multiplier applied to the ball's complete speed profile: serve speed, minimum speed, maximum speed, and per-hit Rally Tempo Ramp. It does not change input sensitivity, bot movement, or serve delays.
_Avoid_: Game speed, simulation speed, time scale

**Bot Difficulty**:
A player-selected profile for the bot's movement speed, reaction time, and tracking error. The available levels are Easy, Medium, Hard, and Expert; Medium is the default. Expert represents the strongest practical bot but does not guarantee that it can return every ball.
_Avoid_: Unbeatable, guaranteed win, scripted miss chance
