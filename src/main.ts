import Phaser from 'phaser'
import { GAME_CONFIG } from './game/config'
import { TankBattleScene } from './game/scenes/TankBattleScene'
import './styles/index.css'

new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'app',
  width: GAME_CONFIG.width,
  height: GAME_CONFIG.height,
  backgroundColor: GAME_CONFIG.colors.ground,
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  scene: TankBattleScene,
})
