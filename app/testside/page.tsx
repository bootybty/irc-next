'use client';

export default function TestSide() {
  const currentUser = "TESTUSER";
  const exampleMessages = [
    { user: "ALICE", content: "Hey @testuser hvordan har du det?", self: true },
    { user: "BOB", content: "Har du set @alice's nye projekt?", self: false },
    { user: "CHARLIE", content: "@testuser @bob kom og se dette!", self: true },
    { user: "DAVE", content: "Normal besked uden mentions", self: false },
    { user: "EVE", content: "Dette er en @testuser mention i en lang besked der viser hvordan det ser ud når teksten fortsætter efter mention", self: true }
  ];

  const renderMessage = (content: string, designType: string, isSelf: boolean) => {
    const mentionRegex = /@(\w+)/g;
    const parts = content.split(mentionRegex);
    
    return parts.map((part, index) => {
      if (index % 2 === 1) {
        const isMentioningSelf = part.toLowerCase() === currentUser.toLowerCase();
        let className = '';
        
        switch (designType) {
          case 'current':
            className = `font-bold ${
              isMentioningSelf 
                ? 'bg-yellow-600 text-black px-1 rounded' 
                : 'text-cyan-400'
            }`;
            break;
            
          case 'design1':
            className = `font-bold ${
              isMentioningSelf 
                ? 'bg-green-400 text-black px-1 py-0.5 rounded border border-green-300' 
                : 'text-green-300 bg-gray-800 px-1 rounded'
            }`;
            break;
            
          case 'design2':
            className = `font-bold ${
              isMentioningSelf 
                ? 'text-yellow-400 bg-yellow-900 px-1 py-0.5 rounded border-l-2 border-yellow-400' 
                : 'text-cyan-300 underline decoration-cyan-400'
            }`;
            break;
            
          case 'design3':
            className = `font-bold ${
              isMentioningSelf 
                ? 'text-black bg-gradient-to-r from-green-400 to-green-300 px-2 py-0.5 rounded-full shadow-sm' 
                : 'text-cyan-400 bg-cyan-900 bg-opacity-30 px-1 rounded border border-cyan-600'
            }`;
            break;
            
          case 'design4':
            className = `font-bold ${
              isMentioningSelf 
                ? 'text-green-400 bg-green-900 px-1 py-0.5 rounded border border-green-400 shadow-[0_0_5px_rgba(34,197,94,0.3)]' 
                : 'text-cyan-400 border-b border-cyan-400 border-dotted'
            }`;
            break;
            
          case 'design5':
            className = `font-bold ${
              isMentioningSelf 
                ? 'text-yellow-300 bg-yellow-800 px-2 py-0.5 rounded-sm border-t border-yellow-300' 
                : 'text-cyan-300 bg-gray-900 px-1 rounded-sm'
            }`;
            break;
            
          case 'design6':
            className = `font-bold ${
              isMentioningSelf 
                ? 'text-black bg-green-400 px-1 py-0.5 rounded-sm font-mono border-2 border-green-300' 
                : 'text-cyan-400 bg-cyan-950 px-1 rounded border border-cyan-700'
            }`;
            break;
            
          case 'design7':
            className = `font-bold ${
              isMentioningSelf 
                ? 'text-green-400 bg-black px-2 py-1 border border-green-400 rounded-md shadow-[inset_0_0_8px_rgba(34,197,94,0.3)]' 
                : 'text-cyan-400 bg-gray-800 px-1 py-0.5 rounded border-l-4 border-cyan-400'
            }`;
            break;
            
          case 'design8':
            className = `font-bold ${
              isMentioningSelf 
                ? 'text-yellow-300 bg-yellow-900 bg-opacity-50 px-2 py-0.5 rounded-full border border-yellow-400 animate-pulse' 
                : 'text-cyan-300 relative before:content-["["] after:content-["]"] before:text-cyan-500 after:text-cyan-500'
            }`;
            break;
            
          case 'design9':
            className = `font-bold ${
              isMentioningSelf 
                ? 'text-black bg-gradient-to-r from-yellow-400 via-green-400 to-yellow-400 px-2 py-0.5 rounded border border-green-300' 
                : 'text-cyan-400 bg-gradient-to-r from-transparent via-cyan-900 to-transparent px-1 py-0.5'
            }`;
            break;
            
          case 'design10':
            className = `font-bold ${
              isMentioningSelf 
                ? 'text-green-300 bg-green-950 px-2 py-1 rounded-lg border-2 border-green-400 shadow-[0_0_10px_rgba(34,197,94,0.5)] uppercase' 
                : 'text-cyan-400 italic border-b-2 border-dotted border-cyan-400'
            }`;
            break;
            
          case 'design11':
            className = `font-bold ${
              isMentioningSelf 
                ? 'text-yellow-400 bg-gray-900 px-2 py-0.5 rounded-sm border-t-2 border-b-2 border-yellow-400' 
                : 'text-cyan-400 bg-cyan-950 bg-opacity-50 px-1 rounded-full'
            }`;
            break;
            
          case 'design12':
            className = `font-bold ${
              isMentioningSelf 
                ? 'text-black bg-green-400 px-2 py-1 rounded-none border-l-4 border-r-4 border-green-300 shadow-md' 
                : 'text-cyan-300 underline decoration-2 decoration-dashed decoration-cyan-400'
            }`;
            break;
            
          case 'design13':
            className = `font-bold ${
              isMentioningSelf 
                ? 'text-green-400 bg-transparent px-2 py-0.5 border-2 border-green-400 rounded-md shadow-[inset_0_0_5px_rgba(34,197,94,0.2)]' 
                : 'text-cyan-400 bg-cyan-900 bg-opacity-20 px-1 py-0.5 rounded-sm border border-cyan-600'
            }`;
            break;
            
          case 'design14':
            className = `font-bold ${
              isMentioningSelf 
                ? 'text-yellow-300 bg-yellow-800 bg-opacity-80 px-3 py-1 rounded-full border border-yellow-300 shadow-lg' 
                : 'text-cyan-400 relative before:content-["»"] after:content-["«"] before:text-cyan-600 after:text-cyan-600 before:mr-1 after:ml-1'
            }`;
            break;
            
          case 'design15':
            className = `font-bold ${
              isMentioningSelf 
                ? 'text-black bg-gradient-to-b from-green-300 to-green-500 px-2 py-1 rounded-md border border-green-200 shadow-inner' 
                : 'text-cyan-400 bg-gray-800 px-1 py-0.5 rounded border-r-4 border-cyan-400'
            }`;
            break;
            
          case 'subtle1':
            className = `font-bold ${
              isMentioningSelf 
                ? 'text-green-300 border-b border-green-400 border-dotted' 
                : 'text-cyan-400 border-b border-cyan-500 border-dotted'
            }`;
            break;
            
          case 'subtle2':
            className = `font-bold ${
              isMentioningSelf 
                ? 'text-yellow-300 bg-yellow-900 bg-opacity-20 px-1' 
                : 'text-cyan-400 bg-cyan-950 bg-opacity-30 px-1'
            }`;
            break;
            
          case 'subtle3':
            className = `font-bold ${
              isMentioningSelf 
                ? 'text-green-400 border-l-2 border-green-400 pl-1' 
                : 'text-cyan-400 border-l border-cyan-500 pl-1'
            }`;
            break;
            
          case 'subtle4':
            className = `font-bold ${
              isMentioningSelf 
                ? 'text-yellow-400 underline decoration-yellow-400 decoration-1' 
                : 'text-cyan-400 underline decoration-cyan-500 decoration-1'
            }`;
            break;
            
          case 'subtle5':
            className = `font-bold ${
              isMentioningSelf 
                ? 'text-green-300 bg-green-950 bg-opacity-40 px-1 rounded-sm' 
                : 'text-cyan-400 bg-gray-800 bg-opacity-50 px-1 rounded-sm'
            }`;
            break;
            
          case 'subtle6':
            className = `font-bold ${
              isMentioningSelf 
                ? 'text-yellow-300 border-b-2 border-yellow-500' 
                : 'text-cyan-400 border-b border-cyan-500'
            }`;
            break;
            
          case 'subtle7':
            className = `font-bold ${
              isMentioningSelf 
                ? 'text-green-400 relative before:content-["▶"] before:text-green-500 before:text-xs before:mr-1 after:content-["◀"] after:text-green-500 after:text-xs after:ml-1' 
                : 'text-cyan-400 italic'
            }`;
            break;
            
          case 'subtle8':
            className = `font-bold ${
              isMentioningSelf 
                ? 'text-yellow-300 bg-yellow-900 bg-opacity-15 border border-yellow-600 border-opacity-30 px-1 rounded' 
                : 'text-cyan-400 bg-cyan-950 bg-opacity-20 px-1 rounded'
            }`;
            break;
        }
        
        return (
          <span key={index} className={className}>
            @{part}
          </span>
        );
      }
      return part;
    });
  };

  const DesignSection = ({ title, designType, description }: { title: string, designType: string, description: string }) => (
    <div className="mb-8 border border-green-400 p-4 rounded">
      <h3 className="text-yellow-400 font-bold mb-2 text-lg">{title}</h3>
      <p className="text-gray-400 mb-4 text-sm">{description}</p>
      <div className="space-y-2">
        {exampleMessages.map((msg, idx) => (
          <div key={idx} className="text-green-400 break-words">
            &lt;<span className="text-purple-400">{msg.user}</span>&gt; {renderMessage(msg.content, designType, msg.self)}
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-black text-green-400 font-mono p-6">
      <div className="max-w-4xl mx-auto">
        <div className="border-b border-green-400 pb-4 mb-8">
          <h1 className="text-2xl text-yellow-400 font-bold mb-2">IRC MENTION STYLING TEST</h1>
          <p className="text-gray-400">
            Test af forskellige designs for user mentions. Gul/grøn = dig selv er tagget, Cyan/blå = andre er tagget
          </p>
        </div>

        <DesignSection 
          title="NUVÆRENDE DESIGN"
          designType="current"
          description="Det eksisterende design - gul baggrund for selv, cyan tekst for andre"
        />

        <DesignSection 
          title="DESIGN 1: TERMINAL STYLE"
          designType="design1"
          description="Grøn terminal-stil med borders og baggrund for begge typer"
        />

        <DesignSection 
          title="DESIGN 2: MINIMAL ACCENTS"
          designType="design2"
          description="Border-left accent for selv, underline for andre"
        />

        <DesignSection 
          title="DESIGN 3: MODERNE GRADIENT"
          designType="design3"
          description="Gradient baggrund for selv, subtil baggrund for andre"
        />

        <DesignSection 
          title="DESIGN 4: GLOW EFFECT"
          designType="design4"
          description="Lysende border effect for selv, dotted underline for andre"
        />

        <DesignSection 
          title="DESIGN 5: RETRO CONSOLE"
          designType="design5"
          description="Retro konsol stil med top border for selv"
        />

        <DesignSection 
          title="DESIGN 6: BOLD TERMINAL"
          designType="design6"
          description="Fed terminal stil med dobbelt border for selv"
        />

        <DesignSection 
          title="DESIGN 7: INSET GLOW"
          designType="design7"
          description="Inset shadow glow effect for selv, thick left border for andre"
        />

        <DesignSection 
          title="DESIGN 8: ANIMATED BRACKETS"
          designType="design8"
          description="Pulserende effekt for selv, brackets omkring andre mentions"
        />

        <DesignSection 
          title="DESIGN 9: RAINBOW GRADIENT"
          designType="design9"
          description="Gul-grøn gradient for selv, subtil cyan gradient for andre"
        />

        <DesignSection 
          title="DESIGN 10: UPPERCASE GLOW"
          designType="design10"
          description="Store bogstaver med outer glow for selv, italic dotted for andre"
        />

        <DesignSection 
          title="DESIGN 11: HORIZONTAL BARS"
          designType="design11"
          description="Top og bottom borders for selv, rounded pill for andre"
        />

        <DesignSection 
          title="DESIGN 12: SIDE BORDERS"
          designType="design12"
          description="Venstre og højre borders for selv, dashed underline for andre"
        />

        <DesignSection 
          title="DESIGN 13: OUTLINED HOLLOW"
          designType="design13"
          description="Transparent baggrund med border for selv, subtle fill for andre"
        />

        <DesignSection 
          title="DESIGN 14: CHEVRON SYMBOLS"
          designType="design14"
          description="Pill-form med shadow for selv, chevron symbols omkring andre"
        />

        <DesignSection 
          title="DESIGN 15: VERTICAL GRADIENT"
          designType="design15"
          description="Vertikal gradient for selv, right border accent for andre"
        />

        <div className="border-t-2 border-yellow-400 pt-8 mt-8">
          <h2 className="text-yellow-400 font-bold text-xl mb-4">SUBTLE DESIGNS</h2>
          <p className="text-gray-400 mb-6 text-sm">Mere diskrete og minimalistiske designs der ikke distraherer fra chatten</p>
        </div>

        <DesignSection 
          title="SUBTLE 1: DOTTED UNDERLINE"
          designType="subtle1"
          description="Simpel dotted underline - meget diskret"
        />

        <DesignSection 
          title="SUBTLE 2: TRANSPARENT BACKGROUND"
          designType="subtle2"
          description="Meget let transparent baggrund med minimal padding"
        />

        <DesignSection 
          title="SUBTLE 3: LEFT BORDER ACCENT"
          designType="subtle3"
          description="Simpel venstre border accent med padding"
        />

        <DesignSection 
          title="SUBTLE 4: THIN UNDERLINE"
          designType="subtle4"
          description="Tynd underline i matchende farve"
        />

        <DesignSection 
          title="SUBTLE 5: SOFT BACKGROUND"
          designType="subtle5"
          description="Blød baggrund med lav opacity og små rounded corners"
        />

        <DesignSection 
          title="SUBTLE 6: BOTTOM BORDER"
          designType="subtle6"
          description="Bottom border - thicker for selv, normal for andre"
        />

        <DesignSection 
          title="SUBTLE 7: ARROW INDICATORS"
          designType="subtle7"
          description="Små pile omkring egen mention, italic for andre"
        />

        <DesignSection 
          title="SUBTLE 8: MINIMAL BORDER"
          designType="subtle8"
          description="Meget subtil border og baggrund med lav opacity"
        />

        <div className="mt-8 p-4 border border-green-400 rounded">
          <h3 className="text-yellow-400 font-bold mb-2">NOTER:</h3>
          <ul className="text-gray-400 space-y-1 text-sm">
            <li>• Alle designs holder sig til den grønne terminal æstetik</li>
            <li>• Selv-mentions er mere prominente end andre mentions</li>
            <li>• Designs er optimeret til både lys og mørk baggrund</li>
            <li>• Alle bruger eksisterende Tailwind klasser</li>
          </ul>
        </div>

        <div className="mt-6 text-center">
          <a 
            href="/"
            className="text-cyan-400 hover:text-yellow-400 underline"
          >
            ← Tilbage til IRC chat
          </a>
        </div>
      </div>
    </div>
  );
}