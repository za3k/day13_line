"use strict";

class Board {
    game = { moveList: [], turn: "black" };
    locked = true;
    on = {};
    constructor(color, html) {
        this.color = color;
        this.html = html;
        $(document).on("mousemove", this.onMouseMove.bind(this));
        this.html.board.on("click", this.onMouseClick.bind(this));
        this.width = this.html.board[0].getBoundingClientRect().width+36;
        this.height = this.html.board[0].getBoundingClientRect().height+36;
        this.html.preview.hide();
        this.html.board.toggleClass("locked", this.locked);
    }
    error(message) { this.html.error.text(message); }
    clearError() { this.html.error.text(""); }
    unlock() {
        this.locked = false;
        this.html.board.toggleClass("locked", this.locked); // Un-grey
    }
    placeStone(move) {
        const stone = document.createElement("div");
        stone.classList.add("stone");
        stone.classList.add(move.color);
        this.moveStone(stone, move);
        this.html.board.append(stone);
        return stone;
    }
    moveStone(stone, move) {
        stone.style.gridColumnStart = (move.col-1)*2;
        stone.style.gridColumnEnd = (move.col-1)*2+2;
        stone.style.gridRowStart = (move.row-1)*2;
        stone.style.gridRowEnd = (move.row-1)*2+2;
    }
    gameUpdate(game) {
        const numOldMoves = this.game.moveList.length;
        const numNewMoves = game.moveList.length;
        this.game = game;
        if (numNewMoves > numOldMoves) {
            const newMoves = game.moveList.slice(numOldMoves-numNewMoves);
            newMoves.forEach((move) => { this.placeStone(move) });
        }
        if (this.game.victor) {
            this.html.victor.text(this.game.victor);
        } else {
            this.setTurn(this.game.turn);
        }
    }
    setTurn(turn) {
        this.html.turn.text(turn);
    }
    toggleTurn() {
        this.game.turn = (this.game.turn == "white") ? "black" : "white";
        this.setTurn(this.game.turn);
    }
    onMouseClick(ev) {
        let move = this.toStonePos(ev);
        if (this.locked) {
            this.error("Board not yet loaded");
        } else if (this.game.victor) { // Redundant with server
            this.error("The game is over");
        } else if (this.game.turn != this.color) { // Redundant with server
            this.error("It's not your turn");
        } else if (this.game.board[move.col][move.row]) { // Redundant with server
            this.error("That intersection is occupied");
        } else {
            this.clearError();
            // Preview our move locally, immediately
            this.toggleTurn();
            const stone = this.placeStone(move);
            this.game.moveList.push(move); // Make sure not to double-display when we do get the update
            this.html.preview.hide();

            // Push the move to the server
            this.on.move(move, () => {
                this.toggleTurn();
                this.game.moveList = this.game.moveList.slice(0, -1);
                stone.remove();
            });
        }
    }
    toStonePos(ev) {
        // Convert 'board' coordinates to stone coordinates
        const relX = ev.clientX - this.html.board[0].getBoundingClientRect().left+18;
        const relY = ev.clientY - this.html.board[0].getBoundingClientRect().top+18;
        const xfrac = relX/this.width;
        const yfrac = relY/this.height;
        if (xfrac < 0 || xfrac > 1 || yfrac < 0 || yfrac > 1) return;
        const stoneCol = Math.floor(xfrac*19)+1;
        const stoneRow = Math.floor(yfrac*19)+1;
        return {
            color: this.color,
            row: stoneRow,
            col: stoneCol,
        }
    }
    onMouseMove(ev) {
        if (this.locked) return;
        if (this.game.turn != this.color) return;
        if (this.game.victor) return;
        let move = this.toStonePos(ev);
        if (move) { // Display translucent stone preview
            this.moveStone(this.html.preview[0], move);
            this.html.preview.show();
        } else {
            this.html.preview.hide();
        }
    }
}

class ServerTalk {
    connected = false;
    on = {};
    constructor(gameId, color) {
        this.gameId = gameId;
        this.color = color;
        this.fetch();
        setInterval(this.fetch.bind(this), 1000);
    }

    async ajax(url, data, success) {
        $.ajax({
            url: `${window.ajaxPrefix}${url}`,
            method: "POST",
            data: JSON.stringify(data),
            dataType: 'json',
            contentType: 'application/json',
            success: success
        });
    }

    async fetch() {
        this.ajax("/ajax/game", {
            gameId: this.gameId,
        }, (game) => {
            this.on.gameUpdate(game);
            if (!this.connected) this.on.load();
        });
    }

    async move(move, error)  {
        this.ajax("/ajax/game/move", {
            gameId: this.gameId,
            move: move,
        }, (result) => {
            if (!result.success) {
                this.on.error(result.error);
                error();
            }
        });
    }
}

window.onload = (event) => {
    const color = window.location.href.split("/").slice(-1)[0];
    const gameId = window.location.href.split("/").slice(-2)[0];
    const localBoard = window.localBoard = new Board(color, {
        board: $(".board"),
        preview: $(".preview"),
        error: $(".error"),
        turn: $(".turn"),
        victor: $(".victor"),
    });
    const remoteBoard = window.remoteBoard = new ServerTalk(gameId, color);
    localBoard.on.move = remoteBoard.move.bind(remoteBoard);
    remoteBoard.on.error = localBoard.error.bind(localBoard);
    remoteBoard.on.gameUpdate = localBoard.gameUpdate.bind(localBoard);
    remoteBoard.on.load = localBoard.unlock.bind(localBoard);
};
