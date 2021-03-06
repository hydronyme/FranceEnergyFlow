d3.sankey = function() {
  var sankey = {},
      nodeWidth = 24,
      nodePadding = 8,
	  nodeMinHeight = 40,
	  linkFactor = 3,
	  linkSlope = 200,
	  valueFactor = 1,
	  ky,
      size = [1, 1],
      nodes = [],
      links = [];

  sankey.nodeWidth = function(_) {
    if (!arguments.length) return nodeWidth;
    nodeWidth = +_;
    return sankey;
  };

  sankey.nodePadding = function(_) {
    if (!arguments.length) return nodePadding;
    nodePadding = +_;
    return sankey;
  };

  sankey.nodes = function(_) {
    if (!arguments.length) return nodes;
    nodes = _;	
    return sankey;
  };

  sankey.links = function(_) {
    if (!arguments.length) return links;
    links = _;
    return sankey;
  };

  sankey.size = function(_) {
    if (!arguments.length) return size;
    size = _;
    return sankey;
  };
  
  sankey.layout = function(iterations) {
    computeNodeLinks();
    computeNodeValues();
    computeNodeBreadths();
    computeNodeDepths(iterations);
    computeLinkDepths();
	myLayout();
	textPosition();
    return sankey;
  };

  sankey.relayout = function() {
    computeLinkDepths();
	textPosition();
    return sankey;
  };

  sankey.link = function() {
    var curvature = .1;

    function link(d) {
		
		
	var needToAdjustTurnPoint;
	var k=0;
	do {
	  needToAdjustTurnPoint=false;		
      var x0 = d.source.x + d.source.dx,
          x1 = d.target.x,
          y0 = d.source.y + d.sy,
          y1 = d.target.y + d.ty,
		  xA = x0+(x1-x0)*d.turnpoint, 
	      xB = xA+Math.abs((y1-y0)/size[1]*linkSlope), 
          xi = d3.interpolateNumber(xA, xB),
          x2 = xi(curvature),
          x3 = xi(1 - curvature);
		  
		  if(xB>x1 && k++<200) {
			  needToAdjustTurnPoint=true;
			  d.turnpoint*=0.9;
		  }
	} while(needToAdjustTurnPoint);
		  
      return "M" + x0 + "," + y0
           + "L" + xA + "," + y0
           + "C" + x2 + "," + y0
           + " " + x3 + "," + y1
           + " " + xB + "," + y1
           + "L" + x1 + "," + y1;
    }

    link.curvature = function(_) {
      if (!arguments.length) return curvature;
      curvature = +_;
      return link;
    };

    return link;
  };

  // Populate the sourceLinks and targetLinks for each node.
  // Also, if the source and target are not objects, assume they are indices.
  function computeNodeLinks() {
    nodes.forEach(function(node) {
      node.sourceLinks = [];
      node.targetLinks = [];
    });
    links.forEach(function(link) {
      var source = link.source,
          target = link.target;
      if (typeof source === "number") source = link.source = nodes[link.source];
      if (typeof target === "number") target = link.target = nodes[link.target];
      source.sourceLinks.push(link);
      target.targetLinks.push(link);
    });
  }

  // Compute the value (size) of each node by summing the associated links.
  function computeNodeValues() {
    nodes.forEach(function(node) {
      node.value = Math.max(
        d3.sum(node.sourceLinks, value),
        d3.sum(node.targetLinks, value)
      );
    });
  }

  // Iteratively assign the breadth (x-position) for each node.
  // Nodes are assigned the maximum breadth of incoming neighbors plus one;
  // nodes with no incoming links are assigned breadth zero, while
  // nodes with no outgoing links are assigned the maximum breadth.
  function computeNodeBreadths() {
    var remainingNodes = nodes,
        nextNodes,
        x = 0;

    while (remainingNodes.length) {
      nextNodes = [];
      remainingNodes.forEach(function(node) {
        node.x = x;
        node.dx = nodeWidth;
        node.sourceLinks.forEach(function(link) {
          if (nextNodes.indexOf(link.target) < 0) {
            nextNodes.push(link.target);
          }
        });
      });
      remainingNodes = nextNodes;
      ++x;
    }
    //
    moveSinksRight(x);
	nodes.forEach(function(node) {
		if(node.name=="hors ??nergie") node.x=3;
		if(node.name=="export") node.x=3;
		if(node.name=="r??seau ??lectrique") node.x=1.5;
		if(node.x==3) node.x=2.5;
		if(node.x==4) node.x=3.3;
	});
    scaleNodeBreadths((size[0] - nodeWidth) / (x - 1));
  }

  function moveSourcesRight() {
    nodes.forEach(function(node) {
      if (!node.targetLinks.length) {
        node.x = d3.min(node.sourceLinks, function(d) { return d.target.x; }) - 1;
      }
    });
  }

  function moveSinksRight(x) {
    nodes.forEach(function(node) {
      if (!node.sourceLinks.length) {
        node.x = x - 1;
      }
    });
  }

  function scaleNodeBreadths(kx) {
    nodes.forEach(function(node) {
      node.x *= kx;
    });
  }

  function computeNodeDepths(iterations) {
    var nodesByBreadth = d3.nest()
        .key(function(d) { return d.x; })
        .sortKeys(d3.ascending)
        .entries(nodes)
        .map(function(d) { return d.values; });

    //
    initializeNodeDepth();
    resolveCollisions();
    for (var alpha = 1; iterations > 0; --iterations) {
      relaxRightToLeft(alpha *= .99);
      resolveCollisions();
      relaxLeftToRight(alpha);
      resolveCollisions();
    }

    function initializeNodeDepth() {
      ky = d3.min(nodesByBreadth, function(nodes) {
        return (size[1] - (nodes.length - 1) * nodePadding) / d3.sum(nodes, value);
      });
	  var needToAdjustKy;
	  var k=0;
	  do {
		  needToAdjustKy=false;
		  nodesByBreadth.forEach(function(nodes) {
			sumDy=0;
			nodes.forEach(function(node, i) {
			  node.y = i;
			  node.dy = Math.max(node.value * ky,nodeMinHeight);
			  sumDy+=node.dy;
			});
			if(sumDy+(nodes.length - 1) * nodePadding>size[1] && k++<200) {
				ky*=.999;
				needToAdjustKy=true;
			}
		  });
	  } while(needToAdjustKy);

      links.forEach(function(link) {
        link.dy = link.value * ky / linkFactor ;
      });
    }

    function relaxLeftToRight(alpha) {
      nodesByBreadth.forEach(function(nodes, breadth) {
        nodes.forEach(function(node) {
          if (node.targetLinks.length) {
            var y = d3.sum(node.targetLinks, weightedSource) / d3.sum(node.targetLinks, value);
            node.y += (y - center(node)) * alpha;
          }
        });
      });

      function weightedSource(link) {
        return center(link.source) * link.value;
      }
    }

    function relaxRightToLeft(alpha) {
      nodesByBreadth.slice().reverse().forEach(function(nodes) {
        nodes.forEach(function(node) {
          if (node.sourceLinks.length) {
            var y = d3.sum(node.sourceLinks, weightedTarget) / d3.sum(node.sourceLinks, value);
            node.y += (y - center(node)) * alpha;
          }
        });
      });

      function weightedTarget(link) {
        return center(link.target) * link.value;
      }
    }

    function resolveCollisions() {
      nodesByBreadth.forEach(function(nodes) {
        var node,
            dy,
            y0 = 0,
            n = nodes.length,
            i;

        // Push any overlapping nodes down.
        //nodes.sort(ascendingDepth);
        for (i = 0; i < n; ++i) {
          node = nodes[i];
          dy = y0 - node.y;
          if (dy > 0) node.y += dy;
          y0 = node.y + node.dy + nodePadding;
        }

        // If the bottommost node goes outside the bounds, push it back up.
        dy = y0 - nodePadding - size[1];
        if (dy > 0) {
          y0 = node.y -= dy;

          // Push any overlapping nodes back up.
          for (i = n - 2; i >= 0; --i) {
            node = nodes[i];
            dy = node.y + node.dy + nodePadding - y0;
            if (dy > 0) node.y -= dy;
            y0 = node.y;
          }
        }		
      });
    }

    function ascendingDepth(a, b) {
      return a.y - b.y;
    }
  }

  function myLayout() {
    nodes.forEach(function(node) {
		node.textx=node.dx/2;
		node.texty=Math.max(node.dy/2-10,10);
		if(node.name=="centrale ??lectrique") 
			node.y=0;
		if(node.name=="r??seau ??lectrique") 
			node.y=240;
		if(node.name=="rejet") 
			node.y=0;
		if(node.name=="??nergie utile") 
			node.y=500;
	})
  }
	
  function textPosition() {
    links.forEach(function(d) {
		
      var x0 = d.source.x + d.source.dx,
          x1 = d.target.x,
          y0 = d.source.y + d.sy,
          y1 = d.target.y + d.ty,
		  xA = x0+(x1-x0)*d.turnpoint, 
	      xB = xA+Math.abs((y1-y0)/size[1]*linkSlope),
		  secondTurnpoint = (xB-x0)/(x1-x0);
		
		  if(d.labelpos<d.turnpoint) {
			  d.textx = x0+(x1-x0)*d.labelpos;
			  d.texty = y0-d.dy/2-7;
		  }
		  else if (d.labelpos>secondTurnpoint) {
			  d.textx = x0+(x1-x0)*d.labelpos;
			  d.texty = y1-d.dy/2-7;			  
		  }
		  else {
			  d.textx = x0+(x1-x0)*d.labelpos;
			  d.texty = y0+(y1-y0)*(d.textx-xA)/(xB-xA)-d.dy/2-7;			  			  
		  }
		
    });
	
  }
  

  function computeLinkDepths() {
    nodes.forEach(function(node) {
//      node.sourceLinks.sort(ascendingTargetDepth);
//      node.targetLinks.sort(ascendingSourceDepth);
    });
    nodes.forEach(function(node) {		
		
      var sy = node.dy*(1-1/linkFactor)/2, 
	      ty = node.dy*(1-1/linkFactor)/2;

	  if(node.value*ky<nodeMinHeight) {
		  sy=(nodeMinHeight-node.value*ky/linkFactor)/2;
		  ty=(nodeMinHeight-node.value*ky/linkFactor)/2;
	  }
      node.sourceLinks.forEach(function(link) {
		link.sy = sy+link.dy/2; 
        sy += link.dy;
      });
      node.targetLinks.forEach(function(link) {
        link.ty = ty+link.dy/2;
        ty += link.dy;
      });
    });

    function ascendingSourceDepth(a, b) {
      return a.source.y - b.source.y;
    }

    function ascendingTargetDepth(a, b) {
      return a.target.y - b.target.y;
    }
  }

  function center(node) {
    return node.y + node.dy / 2;
  }

  function value(link) {
    return link.value;
  }

  return sankey;
};