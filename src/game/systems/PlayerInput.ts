import Phaser from 'phaser'

export type GameKeys = {
  up: Phaser.Input.Keyboard.Key
  down: Phaser.Input.Keyboard.Key
  left: Phaser.Input.Keyboard.Key
  right: Phaser.Input.Keyboard.Key
  fire: Phaser.Input.Keyboard.Key
  restart: Phaser.Input.Keyboard.Key
  pause: Phaser.Input.Keyboard.Key
  one: Phaser.Input.Keyboard.Key
  two: Phaser.Input.Keyboard.Key
  three: Phaser.Input.Keyboard.Key
}

export function createGameKeys(scene: Phaser.Scene): GameKeys {
  return scene.input.keyboard!.addKeys({
    up: Phaser.Input.Keyboard.KeyCodes.W,
    down: Phaser.Input.Keyboard.KeyCodes.S,
    left: Phaser.Input.Keyboard.KeyCodes.A,
    right: Phaser.Input.Keyboard.KeyCodes.D,
    fire: Phaser.Input.Keyboard.KeyCodes.SPACE,
    restart: Phaser.Input.Keyboard.KeyCodes.R,
    pause: Phaser.Input.Keyboard.KeyCodes.ESC,
    one: Phaser.Input.Keyboard.KeyCodes.ONE,
    two: Phaser.Input.Keyboard.KeyCodes.TWO,
    three: Phaser.Input.Keyboard.KeyCodes.THREE,
  }) as GameKeys
}

export function readMovementDirection(
  cursors: Phaser.Types.Input.Keyboard.CursorKeys,
  keys: GameKeys,
): Phaser.Math.Vector2 {
  const direction = new Phaser.Math.Vector2(0, 0)
  if (cursors.left.isDown || keys.left.isDown) {
    direction.x -= 1
  }
  if (cursors.right.isDown || keys.right.isDown) {
    direction.x += 1
  }
  if (cursors.up.isDown || keys.up.isDown) {
    direction.y -= 1
  }
  if (cursors.down.isDown || keys.down.isDown) {
    direction.y += 1
  }
  return direction
}
