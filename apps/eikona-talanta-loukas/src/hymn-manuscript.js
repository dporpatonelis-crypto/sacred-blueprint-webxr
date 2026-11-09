import { ManuscriptConnections as SharedManuscript } from '../../../shared/journey/manuscript-connections.js';
import { manuscriptForWorld } from './manuscript-content.js';

export class ManuscriptConnections extends SharedManuscript {
  constructor(scene, world, session, actors, approaches, onFinished) {
    super(scene, world, session, actors, approaches, onFinished, manuscriptForWorld(world.id));
  }
}
