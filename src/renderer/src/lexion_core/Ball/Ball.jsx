import { useEffect, useRef, useState } from 'react';
import ballImage from '../../../assets/lesion_over.png';
import './Ball.css';

const SNAP_DISTANCE = 24;
const STASH_PEEK = 40;
const POSITION_KEY = 'lexion.ball.position';

function loadPosition(size) {
  try {
    const saved = localStorage.getItem(POSITION_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      return {
        x: parsed.x,
        y: parsed.y,
        stashed: !!parsed.stashed,
        restoreX: parsed.restoreX,
        restoreY: parsed.restoreY,
        saw: true
      };
    }
  } catch {}

  return {
    x: Math.max(0, window.innerWidth - size),
    y: Math.max(0, window.innerHeight - size),
    stashed: false,
    restoreX: null,
    restoreY: null,
    saw: false
  };
}

function keepInside(position, size, stashed) {
  if (stashed) return position;
  const maxX = window.innerWidth - size;
  const maxY = window.innerHeight - size;
  return {
    ...position,
    x: Math.max(0, Math.min(position.x, maxX)),
    y: Math.max(0, Math.min(position.y, maxY))
  };
}

function clampInside(x, y, size) {
  return {
    x: Math.max(0, Math.min(x, window.innerWidth - size)),
    y: Math.max(0, Math.min(y, window.innerHeight - size))
  };
}

function findEdge(position, size) {
  const maxX = window.innerWidth - size;
  const maxY = window.innerHeight - size;
  const candidates = [
    { name: 'left', distance: position.x },
    { name: 'right', distance: maxX - position.x },
    { name: 'top', distance: position.y },
    { name: 'bottom', distance: maxY - position.y }
  ];
  let edge = null;
  let best = SNAP_DISTANCE;
  for (const candidate of candidates) {
    if (candidate.distance <= best) {
      best = candidate.distance;
      edge = candidate.name;
    }
  }
  return edge;
}

function snapPosition(position, size) {
  const maxX = window.innerWidth - size;
  const maxY = window.innerHeight - size;
  if (position.x < SNAP_DISTANCE) position.x = 0;
  else if (maxX - position.x < SNAP_DISTANCE) position.x = maxX;
  if (position.y < SNAP_DISTANCE) position.y = 0;
  else if (maxY - position.y < SNAP_DISTANCE) position.y = maxY;
  return position;
}

function stashPosition(position, size) {
  const restore = clampInside(position.x, position.y, size);
  const edge = findEdge(restore, size);
  if (!edge) return { ...restore, stashed: false };
  const stashed = { ...restore, stashed: true };
  switch (edge) {
    case 'left':
      stashed.x = -(size - STASH_PEEK);
      break;
    case 'right':
      stashed.x = window.innerWidth - STASH_PEEK;
      break;
    case 'top':
      stashed.y = -(size - STASH_PEEK);
      break;
    case 'bottom':
      stashed.y = window.innerHeight - STASH_PEEK;
      break;
  }
  return stashed;
}

export default function Ball({ size, connected, talking, partnerSpeaking, onRef, onPositionChange, onClick, onToggleVoice }) {
  const initial = loadPosition(size);
  const [position, setPosition] = useState({
    x: initial.x,
    y: initial.y,
    restoreX: initial.restoreX,
    restoreY: initial.restoreY
  });
  const [stashed, setStashed] = useState(initial.stashed);
  const [moving, setMoving] = useState(false);
  const [hovered, setHovered] = useState(false);

  const ballRef = useRef(null);
  const movingRef = useRef(false);
  const stashedRef = useRef(stashed);
  const dragRef = useRef(null);
  const positionRef = useRef(position);
  stashedRef.current = stashed;
  positionRef.current = position;

  useEffect(() => {
    const inside = keepInside(initial, size, initial.stashed);
    const next = {
      x: inside.x,
      y: inside.y,
      restoreX: inside.restoreX,
      restoreY: inside.restoreY
    };
    setPosition(next);
    onPositionChange?.({ x: next.x, y: next.y });
  }, []);

  const savePosition = (nextPosition, nextStashed) => {
    try {
      localStorage.setItem(
        POSITION_KEY,
        JSON.stringify({
          x: nextPosition.x,
          y: nextPosition.y,
          stashed: nextStashed,
          restoreX: nextPosition.restoreX,
          restoreY: nextPosition.restoreY
        })
      );
    } catch {}
  };

  useEffect(() => {
    movingRef.current = moving;
    if (!moving) return;

    const onMove = (event) => {
      if (!movingRef.current || !dragRef.current) return;
      const next = {
        ...positionRef.current,
        x: event.clientX - dragRef.current.offsetX,
        y: event.clientY - dragRef.current.offsetY
      };
      const inside = keepInside(next, size, stashedRef.current);
      setPosition(inside);
      onPositionChange?.({ x: inside.x, y: inside.y });
    };

    const onUp = (event) => {
      if (event.button !== 2) return;
      dragRef.current = null;
      movingRef.current = false;
      setMoving(false);
      document.body.style.cursor = '';

      const current = positionRef.current;

      if (stashedRef.current) {
        const restore = {
          x: current.restoreX ?? current.x,
          y: current.restoreY ?? current.y,
          restoreX: null,
          restoreY: null
        };
        setStashed(false);
        setPosition(restore);
        onPositionChange?.({ x: restore.x, y: restore.y });
        savePosition(restore, false);
        return;
      }

      const edge = findEdge(current, size);
      if (edge) {
        const stashedPos = stashPosition(current, size);
        const next = {
          x: stashedPos.x,
          y: stashedPos.y,
          restoreX: clampInside(current.x, current.y, size).x,
          restoreY: clampInside(current.x, current.y, size).y
        };
        setStashed(true);
        setPosition(next);
        onPositionChange?.({ x: next.x, y: next.y });
        savePosition(next, true);
        return;
      }

      const snapped = snapPosition({ ...current }, size);
      setPosition(snapped);
      onPositionChange?.({ x: snapped.x, y: snapped.y });
      savePosition(snapped, false);
    };

    const onCancel = () => {
      dragRef.current = null;
      movingRef.current = false;
      setMoving(false);
      document.body.style.cursor = '';
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    window.addEventListener('blur', onCancel);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      window.removeEventListener('blur', onCancel);
    };
  }, [moving, size, onPositionChange]);

  const onMouseDown = (event) => {
    if (event.button === 0) {
      if (stashedRef.current) event.preventDefault();
      return;
    }
    if (event.button !== 2) return;
    event.preventDefault();
    dragRef.current = {
      offsetX: event.clientX - positionRef.current.x,
      offsetY: event.clientY - positionRef.current.y
    };
    setMoving(true);
    document.body.style.cursor = 'grabbing';
  };

  const unstash = () => {
    const restore = {
      x: positionRef.current.restoreX ?? positionRef.current.x,
      y: positionRef.current.restoreY ?? positionRef.current.y,
      restoreX: null,
      restoreY: null
    };
    setStashed(false);
    setPosition(restore);
    onPositionChange?.({ x: restore.x, y: restore.y });
    savePosition(restore, false);
  };

  const handleClick = () => {
    if (stashedRef.current) {
      unstash();
      return;
    }
    onClick?.();
  };

  const handleDoubleClick = () => {
    if (stashedRef.current) return;
    onToggleVoice?.();
  };

  const setupRef = (element) => {
    ballRef.current = element;
    onRef?.(element);
  };

  const className = [
    'lexion-ball',
    connected ? 'is-connected' : '',
    talking ? 'is-talking' : '',
    partnerSpeaking ? 'is-partner-speaking' : '',
    moving ? 'is-moving' : '',
    stashed ? 'is-stashed' : '',
    hovered ? 'is-hovered' : ''
  ]
    .filter(Boolean)
    .join(' ');

  const title = stashed
    ? 'Click to show'
    : 'Click to chat • Double-click to toggle voice • Right-drag to move';

  return (
    <button
      ref={setupRef}
      id="lexion-ball"
      className={className}
      style={{ width: size, height: size, left: position.x, top: position.y }}
      title={title}
      onMouseDown={onMouseDown}
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onContextMenu={(e) => e.preventDefault()}
    >
      <img src={ballImage} alt="" draggable="false" />
    </button>
  );
}