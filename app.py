#!/bin/python3
import flask, flask_login
from flask import url_for, request, render_template, redirect
from flask_login import current_user
import collections, json, random
from datetime import datetime
from base import app,load_info,ajax,DBDict,DBList,random_id,hash_id,full_url_for

# -- Info for every Hack-A-Day project --
load_info({
    "project_name": "Hack-A-Line",
    "source_url": "https://github.com/za3k/day13_line",
    "subdir": "/hackaday/line",
    "description": "five-in-a-row game",
    "login": False,
})

# -- Routes specific to this Hack-A-Day project --

games = DBDict("game")
class IllegalMove(Exception):
    def __init__(self, message):
        self.message = message
def other_color(color):
    if color == "black":
        return "white"
    else:
        return "black"
class Game():
    def __init__(self):
        self.turn = "black"
        self.board = [[None]*19 for _ in range(19)]
        self.move_list = []
        self.victor = None
        self.id = random_id()
        self.save()
    @classmethod
    def lookup(cls, game_id):
        global games
        if game_id not in games:
            games[game_id] = Game()
        return games[game_id]
    def save(self):
        global games
        games[self.id] = self
    def get(self):
        return {
            "moveList": self.move_list,
            "victor": self.victor,
            "turn": self.turn,
            "board": self.board,
        }
    def update_victor(self):
        # Update the victor based on the board
        poss_victors = set()
        for row in range(19): # left to right
            for start_col in range(15):
                poss_victors.add(frozenset(self.board[row][col] for col in range(start_col, start_col+5)))
        for col in range(19): # left to right
            for start_row in range(15):
                poss_victors.add(frozenset(self.board[row][col] for row in range(start_row, start_row+5)))
        for start_row in range(15): # diagonally from top-left to bottom-right
            for start_col in range(15):
                poss_victors.add(frozenset(self.board[start_row+i][start_col+i] for i in range(5)))
        for start_row in range(5, 19): # diagonally from top-right to bottom-left
            for start_col in range(15):
                poss_victors.add(frozenset(self.board[start_row-i][start_col+i] for i in range(5)))
        if frozenset(["black"]) in poss_victors:
            self.victor = "black"
        elif frozenset(["white"]) in poss_victors:
            self.victor = "white"
    def move(self, m):
        if self.turn != m["color"]:
            raise IllegalMove("Not your turn")
        elif self.victor is not None:
            raise IllegalMove("Game is over")
        elif self.board[m["col"]][m["row"]] is not None:
            raise IllegalMove("That intersection is occupied")
        self.board[m["col"]][m["row"]]=m["color"]
        self.update_victor()
        self.move_list.append(m)
        self.turn = other_color(self.turn)
        self.save()

@app.route("/")
def index():
    return flask.render_template('index.html')

@app.route("/game/new")
def new_game():
	game = Game()
	color = random.choice(["white", "black"])
	return redirect(url_for("game", game_id=game.id, color=color))

@app.route("/game/<game_id>/<color>")
def game(game_id, color):
    game = Game.lookup(game_id)
    opponent_url = full_url_for("game", game_id=game.id, color=other_color(color))
    return flask.render_template("game.html", game=game, color=color, opponent_url=opponent_url)

@ajax("/ajax/game/move")
def ajax_move(json):
    game = Game.lookup(json["gameId"])
    try:
        game.move(json["move"])
    except IllegalMove as e:
        return { "success": False, "error": e.message }
    return { "success": True }

@ajax("/ajax/game")
def ajax_game(json):
    game = Game.lookup(json["gameId"])
    return game.get()
