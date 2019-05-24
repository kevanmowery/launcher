import * as React from 'react';
import { ArrowKeyStepper, AutoSizer, List, ListRowProps, ScrollIndices } from 'react-virtualized';
import { RenderedSection } from 'react-virtualized/dist/es/Grid';
import { IGameInfo } from '../../shared/game/interfaces';
import { GameImageCollection } from '../image/GameImageCollection';
import { IDefaultProps } from '../interfaces';
import { GameListItem } from './GameListItem';
import { GameOrderBy, GameOrderReverse } from '../../shared/order/interfaces';
import { findElementAncestor } from '../Util';

/** A function that receives an HTML element. */
type RefFunc<T extends HTMLElement> = (instance: T | null) => void;

export interface IGameListProps extends IDefaultProps {
  gameImages: GameImageCollection;
  /** All games that will be shown in the list */
  games?: IGameInfo[];
  /** Selected game (if any) */
  selectedGame?: IGameInfo;
  /** Dragged game (if any) */
  draggedGame?: IGameInfo;
  /** Height of each row/item in the list (in pixels) */
  rowHeight: number;
  /** Function that renders the child(ren) of the game list when it is empty */
  noRowsRenderer?: () => JSX.Element;
  /** Called when a game is selected */
  onGameSelect?: (game?: IGameInfo) => void;
  /** Called when a game is launched */
  onGameLaunch: (game: IGameInfo) => void;
  /** Called when a context menu should be opened */
  onContextMenu?: (game: IGameInfo) => void;
  /** Called when a game is dragged */
  onGameDragStart?: (event: React.DragEvent, game: IGameInfo, index: number) => void;
  /** Called when a game is ending being dragged */
  onGameDragEnd?: (event: React.DragEvent, game: IGameInfo, index: number) => void;
  // React-Virtualized Pass-through
  orderBy?: GameOrderBy;
  orderReverse?: GameOrderReverse;
  /** Function for getting a reference to list element. Called whenever the reference could change. */
  listRef?: RefFunc<HTMLDivElement>;
}

export class GameList extends React.Component<IGameListProps, {}> {
  private _wrapper: React.RefObject<HTMLDivElement> = React.createRef();

  constructor(props: IGameListProps) {
    super(props);
  }

  componentDidMount(): void {
    this.updateCssVars();
  }

  componentDidUpdate(): void {
    this.updateCssVars();
  }

  render() {
    const games = this.props.games || [];
    const rowCount = games.length;
    // Calculate column and row of selected item
    let scrollToIndex: number = -1;
    if (this.props.selectedGame) {
      scrollToIndex = games.indexOf(this.props.selectedGame);
    }
    // Render
    return (
      <div className='game-browser__center__inner' ref={this._wrapper} onKeyPress={this.onKeyPress} onContextMenu={this.onContextMenu}>
        <AutoSizer>
          {({ width, height }) => (
            <ArrowKeyStepper
              onScrollToChange={this.onScrollToChange}
              mode='cells'
              isControlled={true}
              columnCount={1}
              rowCount={rowCount}
              scrollToRow={scrollToIndex}>
              {({ onSectionRendered, scrollToColumn, scrollToRow }) => (
                <List
                  className='game-list simple-scroll'
                  width={width}
                  height={height}
                  rowHeight={this.props.rowHeight}
                  rowCount={rowCount}
                  overscanRowCount={15}
                  noRowsRenderer={this.props.noRowsRenderer}
                  rowRenderer={this.rowRenderer}
                  // ArrowKeyStepper props
                  scrollToIndex={scrollToRow}
                  onRowsRendered={this.onRowsRendered.bind(this, onSectionRendered)}
                  // Pass-through props (they have no direct effect on the list)
                  // (If any property is changed the list is re-rendered, even these)
                  orderBy={this.props.orderBy}
                  orderReverse={this.props.orderReverse}
                  />
              )}
            </ArrowKeyStepper>
          )}
        </AutoSizer>
      </div>
    );
  }

  /** Renders a single row / list item */
  rowRenderer = (props: ListRowProps): React.ReactNode => {
    const { draggedGame, games, gameImages, rowHeight, selectedGame } = this.props;
    if (!games) { throw new Error('Trying to render a row in game list, but no games are found?'); }
    if (!gameImages) { throw new Error('Trying to render a row in game list, but game thumbnail loader is not found?'); }
    const game = games[props.index];
    let thumbnail = gameImages.getThumbnailPath(game);
    return (
      <GameListItem key={props.key} {...props}
                    game={game}
                    thumbnail={thumbnail || ''}
                    height={rowHeight}
                    isSelected={game === selectedGame}
                    isDragged={game === draggedGame}
                    onClick={this.onItemClick}
                    onDoubleClick={this.onItemDoubleClick}
                    onDragStart={this.onItemDragStart}
                    onDragEnd={this.onItemDragEnd} />
    );
  }

  /** When a key is pressed (while the list, or one of its children, is selected) */
  onKeyPress = (event: React.KeyboardEvent): void => {
    if (event.key === 'Enter') {
      if (this.props.selectedGame) {
        this.props.onGameLaunch(this.props.selectedGame);
      }
    }
  }

  onContextMenu = (event: React.MouseEvent<HTMLElement>): void => {
    const element = findElementAncestor(event.target as Element, target => GameListItem.isElement(target));
    if (element) {
      const id = GameListItem.getId(element);
      // Get props
      const { games, onContextMenu } = this.props;
      if (!games)         { throw new Error('Failed to open context menu. Prop "games" not found.');         }
      if (!onContextMenu) { throw new Error('Failed to open context menu. Prop "onContextMenu" not found.'); }
      // Find game and call back
      const game = games.find(item => item.id === id);
      if (!game) { throw new Error('Failed to open context menu. Game not found.'); }
      onContextMenu(game);
    }
  }

  /** When a list item is clicked */
  onItemClick = (game: IGameInfo, index: number): void => {
    this.onGameSelect(game);
  }
  
  /** When a list item is double clicked */
  onItemDoubleClick = (game: IGameInfo, index: number): void => {
    this.props.onGameLaunch(game);
  }
  
  /** When a list item is started to being dragged */
  onItemDragStart = (event: React.DragEvent, game: IGameInfo, index: number): void => {
    if (this.props.onGameDragStart) {
      this.props.onGameDragStart(event, game, index);
    }
  }
  
  /** When a list item is ended to being dragged */
  onItemDragEnd = (event: React.DragEvent, game: IGameInfo, index: number): void => {
    if (this.props.onGameDragEnd) {
      this.props.onGameDragEnd(event, game, index);
    }
  }

  /** When a row/item is selected */
  onScrollToChange = (params: ScrollIndices): void => {
    if (!this.props.games) { throw new Error('Games array is missing.'); }
    if (params.scrollToRow === -1) {
      this.onGameSelect(undefined);
    } else {
      const game = this.props.games[params.scrollToRow];
      if (game) {
        this.onGameSelect(game);
      }
    }
  }

  /** When the game list renders - argument contains the indices of first/last rows rendered */
  onRowsRendered = (onSectionRendered: (params: RenderedSection) => void, info: RowsRenderedInfo): void => {
    onSectionRendered({
      columnOverscanStartIndex: 0,
      columnOverscanStopIndex: 0,
      columnStartIndex: 0,
      columnStopIndex: 0,
      rowOverscanStartIndex: info.overscanStartIndex,
      rowOverscanStopIndex: info.overscanStopIndex,
      rowStartIndex: info.startIndex,
      rowStopIndex: info.stopIndex,
    });
  }

  onGameSelect(game?: IGameInfo): void {
    if (this.props.onGameSelect) {
      this.props.onGameSelect(game);
    }
  }

  /** Update CSS Variables */
  updateCssVars() {
    const wrapper = this._wrapper.current;
    if (!wrapper) { throw new Error('Browse Page wrapper div not found'); }
    wrapper.style.setProperty('--height', this.props.rowHeight+'');
  }

  /**
   * Call the "ref" property functions.
   * Do this whenever there's a possibility that the referenced elements has been replaced.
   */
  updatePropRefs(): void {
    if (this.props.listRef) {
      // Find the list element
      let ref: HTMLDivElement | null = null;
      if (this._wrapper.current) {
        const inner = this._wrapper.current.querySelector('.game-list');
        if (inner) { ref = inner as HTMLDivElement; }
      }
      this.props.listRef(ref);
    }
  }
}

/** The interface used by the only parameter of List's prop onRowsRendered */
interface RowsRenderedInfo {
  overscanStartIndex: number;
  overscanStopIndex: number;
  startIndex: number;
  stopIndex: number;
}
