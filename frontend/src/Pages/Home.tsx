import { useState, useEffect } from "react";
import logo from "../assets/logo.gif";
import how from "../assets/how.gif";
import step1 from "../assets/step1.gif";
import step2 from "../assets/step2.gif";
import step3 from "../assets/step3.gif";
import step4 from "../assets/step4.gif";
import step5 from "../assets/step5.gif";
import about from "../assets/about.gif";
import news from "../assets/news.gif";
import colorAtlas from "../assets/color_atlas.gif";
import eyesAtlas from "../assets/eyes_atlas.gif";
import mouthAtlas from "../assets/mouth_atlas.gif";
import randomize from "../assets/randomize.gif";
import background from "../assets/background.png";

const SPRITE_SIZE = 48;

const avatarStrip = [
  { color: 0, eyes: 0, mouth: 0 },
  { color: 1, eyes: 3, mouth: 1 },
  { color: 2, eyes: 6, mouth: 2 },
  { color: 3, eyes: 8, mouth: 3 },
  { color: 4, eyes: 10, mouth: 4 },
  { color: 5, eyes: 13, mouth: 5 },
  { color: 6, eyes: 15, mouth: 6 },
  { color: 7, eyes: 17, mouth: 7 },
];

function spriteStyle(atlas: string, index: number) {
  const x = -(index % 10) * SPRITE_SIZE;
  const y = -Math.floor(index / 10) * SPRITE_SIZE;

  return {
    backgroundImage: `url(${atlas})`,
    backgroundRepeat: "no-repeat",
    backgroundPosition: `${x}px ${y}px`,
    width: `${SPRITE_SIZE}px`,
    height: `${SPRITE_SIZE}px`,
  };
}

export function Home() {
  const [name, setName] = useState("");
  const [currentStep, setCurrentStep] = useState(1);
  const steps = [step1, step2, step3, step4, step5];

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentStep((prev) => (prev === 5 ? 1 : prev + 1));
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen text-white">
      <div className="flex items-center justify-center pt-7">
        <img src={logo} alt="Skribbl.io Logo" />
      </div>
      <div className="mx-auto mt-4 w-fit rounded-md  px-3 py-2">
        <div className="flex items-end gap-2">
          {avatarStrip.map((avatar, index) => (
            <div
              key={index}
              className="relative h-12 w-9"
              
            >
              <div className="absolute inset-0" style={spriteStyle(colorAtlas, avatar.color)} />
              <div className="absolute inset-0" style={spriteStyle(eyesAtlas, avatar.eyes)} />
              <div className="absolute inset-0" style={spriteStyle(mouthAtlas, avatar.mouth)} />
            </div>
          ))}
        </div>
      </div>
      <section className="px-6 pt-10">
        <div className="mx-auto w-full max-w-md rounded-xl bg-blue-900 p-5 shadow-lg">
          <div className="mb-4 flex gap-2">
            <input
              type="text"
              placeholder="Enter your name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded bg-amber-50 px-3 py-2 text-black"
            />
            <select className="rounded bg-amber-50 px-2 py-2 text-black">
              <option>English</option>
              <option>Hindi</option>
              <option>Spanish</option>
              <option>French</option>
            </select>
          </div>

          <div
            className="mb-3 relative h-36 rounded border border-blue-700/70 bg-[#123595]"
            style={{
             
              backgroundSize: "260px",
              backgroundPosition: "center",
            }}
          >
            <img
              src={randomize}
              alt="Randomize avatar"
              className="absolute right-3 top-2 h-7 w-7 cursor-pointer"
            />
            <div className="flex h-full items-center justify-center gap-5">
              <div className="flex flex-col gap-1">
                {[0, 1, 2].map((idx) => (
                  <div key={`left-${idx}`} className="avatar-arrow avatar-arrow-left" />
                ))}
              </div>

              <div className="relative h-16 w-16 scale-[1.45]">
                <div className="absolute inset-0" style={spriteStyle(colorAtlas, 8)} />
                <div className="absolute inset-0" style={spriteStyle(eyesAtlas, 11)} />
                <div className="absolute inset-0" style={spriteStyle(mouthAtlas, 7)} />
              </div>

              <div className="flex flex-col gap-1">
                {[0, 1, 2].map((idx) => (
                  <div key={`right-${idx}`} className="avatar-arrow avatar-arrow-right" />
                ))}
              </div>
             
            </div>
          </div>

          <button className="mb-3 w-full rounded-lg bg-green-500 py-3 text-xl font-bold text-white transition hover:bg-green-600">
            Play!
          </button>

          <button className="w-full rounded-lg bg-blue-500 py-3 font-semibold text-white transition hover:bg-blue-600">
            Create Private Room
          </button>
        </div>
      </section>

      <section className="mt-10 bg-[#123595]/75 px-6 py-10 ">
        <div className="mx-auto grid w-full  max-w-6xl gap-6 lg:grid-cols-3">
          <article className="w-full h-96 rounded-lg bg-[#0E2E95] p-6">
            <div className="flex gap-23 ">
              <img className="size-8" src={about} alt="About Skribbl" />
              <h3 className="mb-4 text-2xl font-semibold">About</h3>
            </div>

            <p className="mb-5 text-md text-slate-100">
              skribbl.io is a free online multiplayer drawing and guessing pictionary game.
            </p>
            <p className="mb-5 text-md text-slate-100">
              A normal game consists of a few rounds, where every round a player has to draw their chosen word and
              others have to guess it to gain points!
            </p>

            <p className="mb-5 text-md text-slate-100">
              The person with the most points at the end of the game, will then be crowned as the winner!
            </p>
            <p className="text-md text-slate-100">Have fun !</p>
          </article>

          <article className="rounded-lg bg-[#0E2E95] p-6">
            <div className="flex gap-26">
              <img className="size-8" src={news} alt="News" />
              <h3 className="mb-4 text-2xl font-semibold">News</h3>
            </div>

            <div className="news-scrollbar max-h-[420px] overflow-y-auto pr-2 text-lg text-slate-100">
              <p className="mb-3 border-b border-blue-200/40 pb-2 font-semibold">Fresh paint</p>
              <p>Hello!</p>
              <ul className="ml-5 list-disc space-y-1 text-sm">
                <li>Redesign of the page</li>
                <li>Mobile support</li>
                <li>
                  Reworked toolbar
                  <ul className="ml-5 list-disc ">
                    <li>Undo button</li>
                    <li>More colors</li>
                    <li>Left- and rightclick to select colors and draw</li>
                    <li>Experimental support for pressure touch input</li>
                    <li>Configurable hotkeys</li>
                  </ul>
                </li>
                <li>
                  Better player interactions/moderation
                  <ul className="ml-5 list-disc ">
                    <li>Ability to kick and ban any player as a room owner</li>
                    <li>Votekick, Mute and Report naughty players</li>
                  </ul>
                </li>
                <li>Invite your friends to public rooms</li>
                <li>
                  More room settings
                  <ul className="ml-5 list-disc">
                    <li>Increased player count in custom rooms to 20</li>
                    <li>Set the amount of Words to choose from (1-5)</li>
                    <li>Set the amount of Hints or disable them completely</li>
                    <li>Word modes: Normal, Hidden and Combination</li>
                  </ul>
                </li>
                <li>Updated a bunch of Languages</li>
                <li>Added lots of new words to English and German</li>
                <li>Added Russian</li>
                <li>Added Japanese</li>
                <li>A dozen new avatar options </li>
              </ul>
              <p className="mt-4 text-base">
                Hope you enjoy it! <br /> Please let me know if you find any bugs, or if you have any suggestions!
              </p>
              <p className="mt-5">Thanks! - Mel</p>
            </div>
          </article>
          <article className="h-[400px] rounded-lg bg-[#0E2E95] p-6">
            <div className="flex gap-17">
              <img className="size-8" src={how} alt=" how to play" />
              <h3 className="mb-4 text-xl font-bold">How to play</h3>
            </div>
            <div>
              <img src={steps[currentStep - 1]} alt={`Step ${currentStep}`} />
              <p>Score the most points and be crowned the winner at the end!</p>
              <div className="mt-4 flex justify-center gap-2">
                {steps.map((_, index) => (
                  <button
                    key={index}
                    onClick={() => setCurrentStep(index + 1)}
                    className={`h-3 w-3 rounded-full transition ${
                      currentStep === index + 1 ? "bg-white" : "bg-gray-500"
                    }`}
                  />
                ))}
              </div>
            </div>
          </article>
        </div>
      </section>
    </div>
  );
}
