import Phaser from 'phaser'
import { GAME_CONFIG, UPGRADE_OPTIONS } from '../../config'
import { TANK_SPRITE_ROTATION_OFFSET } from '../../constants'
import type { UpgradeOption, UpgradeType } from '../../types'
import {
  RARITY_WEIGHTS,
  UPGRADE_CAPS,
  rarityColor,
  upgradeCategory,
  upgradeImpact,
} from '../../upgrade-meta'

export type UpgradeReason = 'wave' | 'level'

export type ShowUpgradeOptions = {
  reason: UpgradeReason
  level: number
  waveIndex: number
  upgradeLevels: Record<UpgradeType, number>
}

export class UpgradeRenderer {
  private readonly scene: Phaser.Scene
  private objects: Phaser.GameObjects.GameObject[] = []
  private bounds: Phaser.Geom.Rectangle[] = []
  private choices: UpgradeOption[] = []

  constructor(scene: Phaser.Scene) {
    this.scene = scene
  }

  hasChoices() {
    return this.choices.length > 0
  }

  choiceAt(index: number): UpgradeOption | undefined {
    return this.choices[index]
  }

  hitTest(x: number, y: number): number {
    for (let index = 0; index < this.bounds.length; index += 1) {
      if (Phaser.Geom.Rectangle.Contains(this.bounds[index], x, y)) {
        return index
      }
    }
    return -1
  }

  show(opts: ShowUpgradeOptions): boolean {
    this.clear()
    this.choices = pickChoices(opts.upgradeLevels)
    if (this.choices.length === 0) {
      return false
    }

    const overlay = this.scene.add.graphics().setDepth(60)
    overlay.fillStyle(0x050706, 0.7)
    overlay.fillRect(0, 0, GAME_CONFIG.width, GAME_CONFIG.height)
    overlay.fillStyle(0x0e1612, 0.78)
    overlay.fillRoundedRect(116, 50, 728, 78, 10)
    overlay.lineStyle(1, GAME_CONFIG.colors.xp, 0.34)
    overlay.strokeRoundedRect(116, 50, 728, 78, 10)
    overlay.fillStyle(GAME_CONFIG.colors.xp, 0.9)
    overlay.fillRect(136, 62, 4, 54)
    this.objects.push(overlay)

    const eyebrow
      = opts.reason === 'level' ? `LEVEL ${opts.level} REACHED` : `WAVE ${opts.waveIndex} CLEARED`
    const title = this.scene.add
      .text(GAME_CONFIG.width / 2, 80, opts.reason === 'level' ? 'Choose a Field Mod' : 'Supply Drop', {
        fontFamily: 'Inter, Arial, sans-serif',
        fontSize: '32px',
        color: GAME_CONFIG.colors.text,
        align: 'center',
      })
      .setOrigin(0.5)
      .setDepth(70)
    const subtitle = this.scene.add
      .text(GAME_CONFIG.width / 2, 112, `${eyebrow}  |  Press 1, 2, 3 or click`, {
        fontFamily: 'Inter, Arial, sans-serif',
        fontSize: '13px',
        color: GAME_CONFIG.colors.muted,
        align: 'center',
      })
      .setOrigin(0.5)
      .setDepth(70)
    this.objects.push(title, subtitle)

    this.choices.forEach((choice, index) => {
      this.drawCard(238 + index * 242, 320, choice, index, opts.upgradeLevels)
    })

    return true
  }

  clear() {
    for (const object of this.objects) {
      object.destroy()
    }
    this.objects = []
    this.bounds = []
    this.choices = []
  }

  private drawCard(
    x: number,
    y: number,
    choice: UpgradeOption,
    index: number,
    upgradeLevels: Record<UpgradeType, number>,
  ) {
    const width = 222
    const height = 244
    const left = x - width / 2
    const top = y - height / 2
    const cardColor = rarityColor(choice.rarity)
    const rarityHex = `#${cardColor.toString(16).padStart(6, '0')}`
    const cap = UPGRADE_CAPS[choice.type]
    const nextLevel = Math.min((upgradeLevels[choice.type] ?? 0) + 1, cap)
    const levelText = `+${nextLevel}/${cap}`

    const card = this.scene.add.graphics().setDepth(66)
    const paintCard = (hovered = false) => {
      card.clear()
      card.fillStyle(0x000000, hovered ? 0.34 : 0.22)
      card.fillRoundedRect(left - 5, top + 6, width + 10, height + 12, 10)
      card.fillStyle(0x070908, 0.99)
      card.fillRoundedRect(left, top, width, height, 8)
      card.fillStyle(hovered ? 0x17251f : 0x101815, 1)
      card.fillRoundedRect(left + 8, top + 8, width - 16, height - 16, 5)
      card.fillStyle(cardColor, hovered ? 0.32 : 0.2)
      card.fillRoundedRect(left + 14, top + 14, width - 28, 96, 4)
      card.fillStyle(0x050706, 0.52)
      card.fillRoundedRect(left + 24, top + 26, width - 48, 72, 5)
      card.fillStyle(cardColor, 1)
      card.fillRoundedRect(left + 12, top + 18, 4, height - 36, 2)
      card.fillRoundedRect(left + width - 16, top + 18, 4, height - 36, 2)
      card.fillRect(left + 24, top + 18, width - 48, 3)
      card.fillStyle(0xffffff, hovered ? 0.08 : 0.04)
      card.fillTriangle(left + 16, top + 16, left + width - 18, top + 16, left + width - 54, top + 82)
      card.lineStyle(2, cardColor, hovered ? 1 : 0.88)
      card.strokeRoundedRect(left, top, width, height, 8)
      card.lineStyle(1, 0xffffff, hovered ? 0.2 : 0.13)
      card.strokeRoundedRect(left + 8, top + 8, width - 16, height - 16, 5)
      card.lineStyle(1, 0xffffff, 0.09)
      card.lineBetween(left + 22, top + 122, left + width - 22, top + 122)
      card.lineStyle(2, cardColor, hovered ? 0.82 : 0.5)
      card.lineBetween(left + 20, top + height - 18, left + width - 20, top + height - 18)
    }
    paintCard()
    const hover = this.scene.add.graphics().setDepth(67)
    hover.lineStyle(3, 0xffffff, 0.72)
    hover.strokeRoundedRect(left - 4, top - 4, width + 8, height + 8, 9)
    hover.setAlpha(0)

    const badge = this.scene.add.rectangle(left + 32, top + 34, 36, 28, cardColor, 1).setDepth(68)
    const number = this.scene.add
      .text(left + 30, top + 32, `${index + 1}`, {
        fontFamily: 'Inter, Arial, sans-serif',
        fontSize: '17px',
        color: '#0b0f0d',
      })
      .setOrigin(0.5)
      .setDepth(69)
    number.setPosition(left + 32, top + 34)
    const rarity = this.scene.add
      .text(left + width - 22, top + 30, choice.rarity.toUpperCase(), {
        fontFamily: 'Inter, Arial, sans-serif',
        fontSize: '11px',
        color: rarityHex,
        align: 'right',
      })
      .setOrigin(1, 0.5)
      .setDepth(69)
    const levelBadge = this.scene.add
      .text(left + width - 22, top + 55, levelText, {
        fontFamily: 'Inter, Arial, sans-serif',
        fontSize: '12px',
        color: GAME_CONFIG.colors.text,
        align: 'right',
        backgroundColor: '#070908',
        padding: { x: 6, y: 3 },
      })
      .setOrigin(1, 0.5)
      .setDepth(69)
    const category = this.scene.add
      .text(x, top + 132, upgradeCategory(choice.type), {
        fontFamily: 'Inter, Arial, sans-serif',
        fontSize: '11px',
        color: rarityHex,
        align: 'center',
      })
      .setOrigin(0.5)
      .setDepth(69)
    const titleObj = this.scene.add
      .text(x, top + 158, choice.title, {
        fontFamily: 'Inter, Arial, sans-serif',
        fontSize: '18px',
        color: GAME_CONFIG.colors.text,
        align: 'center',
        wordWrap: { width: 170 },
      })
      .setOrigin(0.5)
      .setDepth(69)
    const description = this.scene.add
      .text(x, top + 198, choice.description, {
        fontFamily: 'Inter, Arial, sans-serif',
        fontSize: '13px',
        color: GAME_CONFIG.colors.muted,
        align: 'center',
        lineSpacing: 4,
        wordWrap: { width: 166 },
      })
      .setOrigin(0.5)
      .setDepth(69)
    const chip = this.scene.add
      .text(x, top + height - 26, `${upgradeImpact(choice.type)}  ${levelText}`, {
        fontFamily: 'Inter, Arial, sans-serif',
        fontSize: '12px',
        color: '#0b0f0d',
        backgroundColor: rarityHex,
        padding: { x: 8, y: 4 },
        align: 'center',
      })
      .setOrigin(0.5)
      .setDepth(69)
    const iconObjects = drawIcon(this.scene, x, top + 70, choice.type, cardColor)
    const progressObjects = drawProgressPips(
      this.scene,
      x,
      top + 111,
      choice.type,
      cardColor,
      upgradeLevels[choice.type] ?? 0,
      true,
    )
    const hitZone = this.scene.add.zone(x, y, width, height).setDepth(80)
    hitZone.setInteractive({ useHandCursor: true })
    hitZone.on('pointerover', () => {
      hover.setAlpha(0.72)
      paintCard(true)
    })
    hitZone.on('pointerout', () => {
      hover.setAlpha(0)
      paintCard()
    })

    this.bounds[index] = new Phaser.Geom.Rectangle(left, top, width, height)
    this.objects.push(
      card,
      hover,
      badge,
      number,
      rarity,
      levelBadge,
      category,
      titleObj,
      description,
      chip,
      hitZone,
      ...iconObjects,
      ...progressObjects,
    )

    const animatedObjects = [
      card,
      badge,
      number,
      rarity,
      levelBadge,
      category,
      titleObj,
      description,
      chip,
      ...iconObjects,
      ...progressObjects,
    ] as Array<Phaser.GameObjects.GameObject & { setAlpha(value: number): unknown; y: number }>
    animatedObjects.forEach((object) => {
      object.setAlpha(0)
      object.y += 14
    })
    hover.y += 14
    hitZone.y += 14
    this.scene.tweens.add({
      targets: animatedObjects,
      alpha: 1,
      y: '-=14',
      delay: index * 70,
      duration: 220,
      ease: 'Cubic.easeOut',
    })
    this.scene.tweens.add({
      targets: [hover, hitZone],
      y: '-=14',
      delay: index * 70,
      duration: 220,
      ease: 'Cubic.easeOut',
    })
  }
}

function pickChoices(upgradeLevels: Record<UpgradeType, number>): UpgradeOption[] {
  const pool = UPGRADE_OPTIONS.filter((option) => {
    const cap = UPGRADE_CAPS[option.type]
    return (upgradeLevels[option.type] ?? 0) < cap
  })

  const result: UpgradeOption[] = []
  const remaining = [...pool]
  for (let pick = 0; pick < 3 && remaining.length > 0; pick += 1) {
    const totalWeight = remaining.reduce((sum, option) => sum + RARITY_WEIGHTS[option.rarity], 0)
    let roll = Math.random() * totalWeight
    let chosenIndex = 0
    for (let index = 0; index < remaining.length; index += 1) {
      roll -= RARITY_WEIGHTS[remaining[index].rarity]
      if (roll <= 0) {
        chosenIndex = index
        break
      }
    }
    result.push(remaining[chosenIndex])
    remaining.splice(chosenIndex, 1)
  }
  return result
}

function drawIcon(
  scene: Phaser.Scene,
  x: number,
  y: number,
  type: UpgradeType,
  color: number,
): Phaser.GameObjects.GameObject[] {
  const objects: Phaser.GameObjects.GameObject[] = []
  const frame = scene.add.graphics().setDepth(68)
  frame.fillStyle(0x050706, 0.62)
  frame.fillRoundedRect(x - 41, y - 35, 82, 70, 6)
  frame.lineStyle(1, color, 0.55)
  frame.strokeRoundedRect(x - 41, y - 35, 82, 70, 6)
  frame.fillStyle(color, 0.16)
  frame.fillCircle(x, y, 28)
  objects.push(frame)

  const addIconImage = (key: string, offsetX = 0, offsetY = 0, size = 48, rotation = 0) => {
    const image = scene.add
      .image(x + offsetX, y + offsetY, key)
      .setDisplaySize(size, size)
      .setDepth(69)
      .setRotation(rotation)
    objects.push(image)
    return image
  }

  if (type === 'armor') {
    addIconImage('decor-barricade-metal', 0, 0, 52)
  } else if (type === 'damage') {
    addIconImage('bullet-player', -8, 0, 48, TANK_SPRITE_ROTATION_OFFSET)
    addIconImage('muzzle-flash', 17, 0, 28, 0.35)
  } else if (type === 'fireRate') {
    addIconImage('muzzle-flash', -14, 0, 30, -0.2)
    addIconImage('muzzle-flash', 14, 0, 30, 0.2)
  } else if (type === 'moveSpeed') {
    addIconImage('tank-scout-body', 0, 0, 52, TANK_SPRITE_ROTATION_OFFSET)
  } else if (type === 'bulletSpeed') {
    addIconImage('bullet-player', 0, 0, 54, TANK_SPRITE_ROTATION_OFFSET)
  } else if (type === 'scoreBonus') {
    addIconImage('decor-crate-metal', 0, 0, 50)
  } else if (type === 'doubleShot') {
    addIconImage('bullet-player', -10, -8, 38, TANK_SPRITE_ROTATION_OFFSET)
    addIconImage('bullet-player', 12, 8, 38, TANK_SPRITE_ROTATION_OFFSET)
  } else if (type === 'tripleShot') {
    addIconImage('bullet-player', -17, 9, 34, TANK_SPRITE_ROTATION_OFFSET - 0.45)
    addIconImage('bullet-player', 0, -2, 36, TANK_SPRITE_ROTATION_OFFSET)
    addIconImage('bullet-player', 17, 9, 34, TANK_SPRITE_ROTATION_OFFSET + 0.45)
  } else if (type === 'piercingShell') {
    addIconImage('bullet-player', -11, 0, 44, TANK_SPRITE_ROTATION_OFFSET)
    addIconImage('bullet-player', 13, 0, 34, TANK_SPRITE_ROTATION_OFFSET)
  } else if (type === 'explosiveShell') {
    addIconImage('muzzle-flash', 0, 0, 54, 0.2)
    addIconImage('bullet-player', -3, -2, 32, TANK_SPRITE_ROTATION_OFFSET)
  } else if (type === 'pickupRadius') {
    addIconImage('decor-crate-wood', 0, 0, 40)
    addIconImage('tile-grass', 18, -16, 24)
  } else if (type === 'bossDamage') {
    addIconImage('tank-heavy-body', 0, 0, 52, TANK_SPRITE_ROTATION_OFFSET)
    addIconImage('muzzle-flash', 18, -16, 26)
  } else if (type === 'critChance' || type === 'critDamage') {
    addIconImage('muzzle-flash', 0, 0, 42, 0)
  } else {
    addIconImage('tile-grass', 0, 0, 52)
  }

  const textLabel
    = type === 'xpBoost'
      ? 'XP'
      : type === 'pickupRadius'
        ? 'R'
        : type === 'critChance'
          ? 'CR'
          : type === 'critDamage'
            ? 'CD'
            : type === 'bossDamage'
              ? 'B'
              : ''
  const label = textLabel
    ? scene.add
      .text(x, y + 1, textLabel, {
        fontFamily: 'Inter, Arial, sans-serif',
        fontSize: '17px',
        color: '#0b0f0d',
      })
      .setOrigin(0.5)
      .setDepth(70)
    : undefined

  if (label) {
    objects.push(label)
  }
  return objects
}

function drawProgressPips(
  scene: Phaser.Scene,
  x: number,
  y: number,
  type: UpgradeType,
  color: number,
  currentLevel: number,
  next: boolean,
): Phaser.GameObjects.GameObject[] {
  const objects: Phaser.GameObjects.GameObject[] = []
  const cap = UPGRADE_CAPS[type]
  const level = Math.min(currentLevel + (next ? 1 : 0), cap)
  const pipCount = Math.min(cap, 8)
  const pipWidth = 10
  const gap = 4
  const totalWidth = pipCount * pipWidth + (pipCount - 1) * gap
  const startX = x - totalWidth / 2

  for (let index = 0; index < pipCount; index += 1) {
    const pip = scene.add
      .rectangle(
        startX + index * (pipWidth + gap) + pipWidth / 2,
        y,
        pipWidth,
        4,
        index < level ? color : 0x314039,
        index < level ? 1 : 0.75,
      )
      .setDepth(69)
    objects.push(pip)
  }

  return objects
}
